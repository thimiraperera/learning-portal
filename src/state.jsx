import { createContext, useContext, useState, useCallback } from "react";
import { seedCourses, seedUsers } from "./data.js";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

/* White-label branding. No client name is hard-coded. An administrator
   sets these in Settings; they persist to localStorage so the same build
   can be deployed for any client. */
const BRAND_KEY = "lms_brand";
const DEFAULT_BRAND = { company: "", name: "Learning Portal", logo: "" };

function loadBrand() {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    return raw ? { ...DEFAULT_BRAND, ...JSON.parse(raw) } : { ...DEFAULT_BRAND };
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

export function StoreProvider({ children }) {
  const [users, setUsers] = useState(() => structuredClone(seedUsers));
  const [courses, setCourses] = useState(() => structuredClone(seedCourses));
  const [user, setUser] = useState(null); // logged-in email
  const [brand, setBrandState] = useState(loadBrand);

  const setBrand = useCallback((next) => {
    setBrandState((prev) => {
      const merged = { ...prev, ...next };
      try { localStorage.setItem(BRAND_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
      return merged;
    });
  }, []);

  const login = useCallback((username, password) => {
    const u = username.trim().toLowerCase();
    const entry = Object.entries(users).find(
      ([, acc]) => acc.username && acc.username.toLowerCase() === u && acc.password === password
    );
    if (entry) { setUser(entry[0]); return { ok: true, role: entry[1].role }; }
    return { ok: false };
  }, [users]);

  const logout = useCallback(() => setUser(null), []);

  /* ---- admin: enrolment matrix ---- */
  const toggleEnrol = useCallback((email, cid) => {
    setUsers((u) => {
      const cur = u[email].enrolled;
      const next = cur.includes(cid) ? cur.filter((x) => x !== cid) : [...cur, cid];
      return { ...u, [email]: { ...u[email], enrolled: next } };
    });
  }, []);

  /* ---- admin: students ---- */
  const addStudent = useCallback((name, email, username, password) => {
    const e = email.trim().toLowerCase();
    const un = username.trim().toLowerCase();
    if (!name.trim() || !e.includes("@")) return { ok: false, msg: "Enter a name and a valid email." };
    if (!un || !password) return { ok: false, msg: "Enter a username and a password." };
    if (users[e]) return { ok: false, msg: "That email already exists." };
    if (Object.values(users).some((acc) => acc.username && acc.username.toLowerCase() === un)) {
      return { ok: false, msg: "That username is already taken." };
    }
    setUsers((u) => ({ ...u, [e]: { name: name.trim(), username: un, password, role: "student", enrolled: [], status: "active" } }));
    return { ok: true, msg: `Student ${name.trim()} added. They can sign in now.` };
  }, [users]);

  const removeStudent = useCallback((email) => {
    setUsers((u) => { const n = { ...u }; delete n[email]; return n; });
  }, []);

  /* ---- admin: courses & materials ---- */
  const addCourse = useCallback((title, code) => {
    if (!title.trim() || !code.trim()) return false;
    const id = "c" + Date.now().toString().slice(-6);
    setCourses((c) => ({
      ...c,
      [id]: { title: title.trim(), code: code.trim().toUpperCase(), instructor: "C. Hettiarachchi",
              blurb: "Newly created course.", sessions: 0, recordings: [], links: [], materials: [] },
    }));
    return true;
  }, []);

  // bucket: "recordings" | "links" | "materials"
  const addItem = useCallback((cid, bucket, value) => {
    const v = value.trim();
    if (!v) return;
    const item =
      bucket === "recordings" ? { t: v, d: "n/a", len: "n/a" } :
      bucket === "links"      ? { t: v, u: "#" } :
                                { t: v, size: "n/a", ext: "PDF" };
    setCourses((c) => ({ ...c, [cid]: { ...c[cid], [bucket]: [...c[cid][bucket], item] } }));
  }, []);

  const removeItem = useCallback((cid, bucket, idx) => {
    setCourses((c) => ({ ...c, [cid]: { ...c[cid], [bucket]: c[cid][bucket].filter((_, i) => i !== idx) } }));
  }, []);

  const value = {
    users, courses, user, brand,
    currentUser: user ? users[user] : null,
    login, logout, setBrand,
    toggleEnrol, addStudent, removeStudent,
    addCourse, addItem, removeItem,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
