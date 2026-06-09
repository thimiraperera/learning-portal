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
  const [instructors, setInstructors] = useState([]);
  const [brand, setBrandLocal] = useState(DEFAULT_BRAND);
  const [smtp, setSmtpLocal] = useState(null);
  const [ready, setReady] = useState(false);

  const applyBootstrap = (data) => {
    setCurrentUser(data.currentUser || null);
    setCourses(data.courses || {});
    setUsers(data.users || {});
    setInstructors(data.instructors || []);
    setLocked(data.locked || []);
    if (data.brand) setBrandLocal({ ...DEFAULT_BRAND, ...data.brand });
    if (data.smtp) setSmtpLocal(data.smtp);
  };
  const applyAdmin = (data) => {
    if (data.courses) setCourses(data.courses);
    if (data.users) setUsers(data.users);
    if (data.instructors) setInstructors(data.instructors);
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

  const updateStudent = useCallback(async (id, fields) => {
    try { applyAdmin(await api(`/admin/students/${id}`, { method: "PUT", token, body: fields })); return { ok: true, msg: "Student updated." }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const addCourse = useCallback(async (title, code) => {
    try { applyAdmin(await api("/admin/courses", { method: "POST", token, body: { title, code } })); return true; }
    catch { return false; }
  }, [token]);

  const updateCourse = useCallback(async (id, fields) => {
    try { applyAdmin(await api(`/admin/courses/${id}`, { method: "PUT", token, body: fields })); return { ok: true, msg: "Course updated." }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const deleteCourse = useCallback(async (id) => {
    applyAdmin(await api(`/admin/courses/${id}`, { method: "DELETE", token }));
  }, [token]);

  const addCourseInstructor = useCallback(async (courseId, instructorId) => {
    applyAdmin(await api(`/admin/courses/${courseId}/instructors`, { method: "POST", token, body: { instructorId } }));
  }, [token]);
  const removeCourseInstructor = useCallback(async (courseId, instructorId) => {
    applyAdmin(await api(`/admin/courses/${courseId}/instructors`, { method: "DELETE", token, body: { instructorId } }));
  }, [token]);

  const addInstructor = useCallback(async (fields) => {
    try { applyAdmin(await api("/admin/instructors", { method: "POST", token, body: fields })); return { ok: true, msg: "Instructor added." }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const updateInstructor = useCallback(async (id, fields) => {
    try { applyAdmin(await api(`/admin/instructors/${id}`, { method: "PUT", token, body: fields })); return { ok: true, msg: "Instructor updated." }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const deleteInstructor = useCallback(async (id) => {
    applyAdmin(await api(`/admin/instructors/${id}`, { method: "DELETE", token }));
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

  /* ---- account self-service (any role) ---- */
  const updateAccount = useCallback(async (fields) => {
    try {
      const { user } = await api("/account", { method: "PUT", token, body: fields });
      setCurrentUser(user);
      return { ok: true, msg: "Profile updated." };
    } catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await api("/account/password", { method: "POST", token, body: { currentPassword, newPassword } });
      return { ok: true, msg: "Password changed." };
    } catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const saveSmtp = useCallback(async (fields) => {
    try {
      const saved = await api("/admin/smtp", { method: "PUT", token, body: fields });
      setSmtpLocal(saved);
      return { ok: true, msg: "SMTP settings saved." };
    } catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const value = {
    ready, currentUser, courses, users, locked, instructors, brand, smtp,
    login, logout, setBrand,
    toggleEnrol, addStudent, removeStudent, updateStudent,
    addCourse, updateCourse, deleteCourse, addItem, removeItem,
    addCourseInstructor, removeCourseInstructor, addInstructor, updateInstructor, deleteInstructor,
    updateAccount, changePassword, saveSmtp,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
