import { createContext, useContext, useState, useEffect, useCallback } from "react";

/* Store backed by the server API (see server.cjs / db.cjs).
   Data is no longer hard-coded in the browser; it lives in the SQLite
   database and is fetched after sign-in. Passwords never reach the client. */

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const TOKEN_KEY = "lms_token";
const DEFAULT_BRAND = { company: "", name: "Learning Portal", logo: "" };

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function StoreProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [courses, setCourses] = useState({});
  const [users, setUsers] = useState({});
  const [locked, setLocked] = useState([]);
  const [brand, setBrandLocal] = useState(DEFAULT_BRAND);
  const [ready, setReady] = useState(false);

  const applyBootstrap = (data) => {
    setCurrentUser(data.currentUser || null);
    setCourses(data.courses || {});
    setUsers(data.users || {});
    setLocked(data.locked || []);
    if (data.brand) setBrandLocal({ ...DEFAULT_BRAND, ...data.brand });
  };
  const applyAdmin = (data) => {
    if (data.courses) setCourses(data.courses);
    if (data.users) setUsers(data.users);
  };

  // On first load: fetch public brand, and restore the session if a token exists.
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const b = await api("/brand"); if (alive) setBrandLocal({ ...DEFAULT_BRAND, ...b }); } catch { /* ignore */ }
      if (token) {
        try {
          const data = await api("/bootstrap", { token });
          if (alive) applyBootstrap(data);
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          if (alive) setToken(null);
        }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const { token: t, user } = await api("/login", { method: "POST", body: { username, password } });
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setCurrentUser(user);
      const data = await api("/bootstrap", { token: t });
      applyBootstrap(data);
      return { ok: true, role: user.role };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try { if (token) await api("/logout", { method: "POST", token }); } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCurrentUser(null);
    setCourses({});
    setUsers({});
    setLocked([]);
  }, [token]);

  /* ---- admin mutations (each returns the fresh admin state) ---- */
  const toggleEnrol = useCallback(async (email, cid) => {
    applyAdmin(await api("/admin/enrol", { method: "POST", token, body: { email, courseId: cid } }));
  }, [token]);

  const addStudent = useCallback(async (name, email, username, password) => {
    try {
      const d = await api("/admin/students", { method: "POST", token, body: { name, email, username, password } });
      applyAdmin(d);
      return { ok: true, msg: d.msg };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }, [token]);

  const removeStudent = useCallback(async (email) => {
    applyAdmin(await api("/admin/students", { method: "DELETE", token, body: { email } }));
  }, [token]);

  const addCourse = useCallback(async (title, code) => {
    try { applyAdmin(await api("/admin/courses", { method: "POST", token, body: { title, code } })); return true; }
    catch { return false; }
  }, [token]);

  const addItem = useCallback(async (cid, bucket, value) => {
    applyAdmin(await api("/admin/items", { method: "POST", token, body: { courseId: cid, bucket, value } }));
  }, [token]);

  const removeItem = useCallback(async (cid, bucket, itemId) => {
    applyAdmin(await api("/admin/items", { method: "DELETE", token, body: { courseId: cid, bucket, itemId } }));
  }, [token]);

  const setBrand = useCallback(async (next) => {
    const saved = await api("/brand", { method: "PUT", token, body: { ...brand, ...next } });
    setBrandLocal({ ...DEFAULT_BRAND, ...saved });
  }, [brand, token]);

  const value = {
    ready, currentUser, courses, users, locked, brand,
    login, logout, setBrand,
    toggleEnrol, addStudent, removeStudent,
    addCourse, addItem, removeItem,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
