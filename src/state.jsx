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
  const [certificates, setCertificates] = useState([]);
  const [exams, setExams] = useState([]);
  const [brand, setBrandLocal] = useState(DEFAULT_BRAND);
  const [smtp, setSmtpLocal] = useState(null);
  const [hcaptcha, setHcaptchaLocal] = useState({ enabled: false, siteKey: "", hasSecretKey: false });
  const [ready, setReady] = useState(false);

  const applyBootstrap = (data) => {
    setCurrentUser(data.currentUser || null);
    setCourses(data.courses || {});
    setUsers(data.users || {});
    setInstructors(data.instructors || []);
    setCertificates(data.certificates || []);
    setExams(data.exams || []);
    setLocked(data.locked || []);
    if (data.brand) setBrandLocal({ ...DEFAULT_BRAND, ...data.brand });
    if (data.smtp) setSmtpLocal(data.smtp);
    if (data.hcaptcha) setHcaptchaLocal(data.hcaptcha);
  };
  const applyAdmin = (data) => {
    if (data.courses) setCourses(data.courses);
    if (data.users) setUsers(data.users);
    if (data.instructors) setInstructors(data.instructors);
    if (data.certificates) setCertificates(data.certificates);
    if (data.exams) setExams(data.exams);
  };

  async function fetchBlobDownload(path, filename) {
    const res = await fetch("/api" + path, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Download failed"); }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  async function fetchBlobOpen(path) {
    // Open the tab synchronously (inside the click) so the browser does not
    // treat it as a blocked popup, then point it at the blob once it loads.
    const win = window.open("", "_blank");
    try {
      const res = await fetch("/api" + path, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Could not open"); }
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url; else window.open(url, "_blank");
    } catch (e) {
      if (win) win.close();
      throw e;
    }
  }

  // On first load: fetch public brand, and restore the session if a token exists.
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const b = await api("/brand"); if (alive) setBrandLocal({ ...DEFAULT_BRAND, ...b }); } catch { /* ignore */ }
      try { const cfg = await api("/auth-config"); if (alive && cfg.hcaptcha) setHcaptchaLocal(cfg.hcaptcha); } catch { /* ignore */ }
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

  const login = useCallback(async (username, password, { code, captcha } = {}) => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, code, captcha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || "Sign in failed", twoFactor: !!data.twoFactor };
      const { token: t, user } = data;
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setCurrentUser(user);
      applyBootstrap(await api("/bootstrap", { token: t }));
      return { ok: true, role: user.role };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, []);

  const register = useCallback(async (token, fields) => {
    try {
      await api(`/register/${token}`, { method: "POST", body: fields });
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
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

  const addStudent = useCallback(async (name, email, username) => {
    try {
      const d = await api("/admin/students", { method: "POST", token, body: { name, email, username } });
      applyAdmin(d);
      return { ok: true, msg: d.msg, link: d.link, sent: d.sent };
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

  const addCourse = useCallback(async (fields) => {
    try { const d = await api("/admin/courses", { method: "POST", token, body: fields }); applyAdmin(d); return { ok: true, id: d.courseId }; }
    catch (e) { return { ok: false, msg: e.message }; }
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
    try { const d = await api("/admin/instructors", { method: "POST", token, body: fields }); applyAdmin(d); return { ok: true, msg: d.msg || "Instructor added." }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const updateInstructor = useCallback(async (id, fields) => {
    try { applyAdmin(await api(`/admin/instructors/${id}`, { method: "PUT", token, body: fields })); return { ok: true, msg: "Instructor updated." }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const deleteInstructor = useCallback(async (id) => {
    applyAdmin(await api(`/admin/instructors/${id}`, { method: "DELETE", token }));
  }, [token]);

  const addItem = useCallback(async (cid, groupId, bucket, value) => {
    applyAdmin(await api("/admin/items", { method: "POST", token, body: { courseId: cid, groupId, bucket, value } }));
  }, [token]);

  const removeItem = useCallback(async (cid, bucket, itemId) => {
    applyAdmin(await api("/admin/items", { method: "DELETE", token, body: { courseId: cid, bucket, itemId } }));
  }, [token]);

  const reorderItems = useCallback(async (cid, bucket, orderedIds) => {
    applyAdmin(await api("/admin/items/reorder", { method: "POST", token, body: { courseId: cid, bucket, orderedIds } }));
  }, [token]);

  /* ---- content groups ---- */
  const addGroup = useCallback(async (cid, title) => {
    try { applyAdmin(await api(`/admin/courses/${cid}/groups`, { method: "POST", token, body: { title } })); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const renameGroup = useCallback(async (cid, gid, title) => {
    try { applyAdmin(await api(`/admin/courses/${cid}/groups/${gid}`, { method: "PUT", token, body: { title } })); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const deleteGroup = useCallback(async (cid, gid) => {
    applyAdmin(await api(`/admin/courses/${cid}/groups/${gid}`, { method: "DELETE", token }));
  }, [token]);
  const reorderGroups = useCallback(async (cid, orderedIds) => {
    applyAdmin(await api(`/admin/courses/${cid}/groups/reorder`, { method: "POST", token, body: { orderedIds } }));
  }, [token]);

  /* ---- certificates ---- */
  const issueManyCertificates = useCallback(async (pairs) => {
    try { const d = await api("/admin/certificates/issue-many", { method: "POST", token, body: { pairs } }); applyAdmin(d); return { ok: true, msg: d.msg }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const unlockCertificate = useCallback(async (id) => {
    applyAdmin(await api(`/admin/certificates/${id}/unlock`, { method: "POST", token }));
  }, [token]);
  const sendCertificate = useCallback(async (id) => {
    try { const d = await api(`/admin/certificates/${id}/send`, { method: "POST", token }); return { ok: d.ok, msg: d.msg }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const adminViewCertificate = useCallback((id) => fetchBlobOpen(`/admin/certificates/${id}/pdf`), [token]);
  const adminDownloadCertificate = useCallback((id, certNo) => fetchBlobDownload(`/admin/certificates/${id}/pdf`, `${certNo || "certificate"}.pdf`), [token]);
  const downloadCertificate = useCallback(async (id, certNo) => {
    await fetchBlobDownload(`/certificates/${id}/download`, `${certNo || "certificate"}.pdf`);
    setCertificates((cs) => cs.map((c) => (c.id === id ? { ...c, downloaded: 1, unlocked: 0 } : c)));
  }, [token]);

  /* ---- certificate templates ---- */
  const fetchCertTemplates = useCallback(() => api("/admin/cert-templates", { token }), [token]);
  const previewCertTemplate = useCallback((id) => fetchBlobOpen(`/admin/cert-templates/${id}/preview`), [token]);

  /* ---- exams (admin) ---- */
  const createExam = useCallback(async (title, courseId) => {
    try { const d = await api("/admin/exams", { method: "POST", token, body: { title, courseId } }); applyAdmin(d); return { ok: true, id: d.examId }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const loadExam = useCallback((id) => api(`/admin/exams/${id}`, { token }).then((d) => d.exam), [token]);
  const updateExam = useCallback(async (id, fields) => {
    try { const d = await api(`/admin/exams/${id}`, { method: "PUT", token, body: fields }); applyAdmin(d); return { ok: true, msg: "Exam updated.", exam: d.exam }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const deleteExam = useCallback(async (id) => {
    applyAdmin(await api(`/admin/exams/${id}`, { method: "DELETE", token }));
  }, [token]);
  const addExamQuestion = useCallback(async (id, qn) => {
    try { const d = await api(`/admin/exams/${id}/questions`, { method: "POST", token, body: qn }); applyAdmin(d); return { ok: true, exam: d.exam }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const updateExamQuestion = useCallback(async (id, qid, qn) => {
    try { const d = await api(`/admin/exams/${id}/questions/${qid}`, { method: "PUT", token, body: qn }); applyAdmin(d); return { ok: true, exam: d.exam }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const deleteExamQuestion = useCallback(async (id, qid) => {
    try { const d = await api(`/admin/exams/${id}/questions/${qid}`, { method: "DELETE", token }); applyAdmin(d); return { ok: true, exam: d.exam }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const importExamCsv = useCallback(async (id, csv, mode) => {
    try { const d = await api(`/admin/exams/${id}/import`, { method: "POST", token, body: { csv, mode } }); applyAdmin(d); return { ok: true, imported: d.imported, errors: d.errors || [], exam: d.exam }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const exportExamCsv = useCallback((id) => fetchBlobDownload(`/admin/exams/${id}/export`, `exam-${id}.csv`), [token]);
  const loadStudentExams = useCallback((id) => api(`/admin/students/${id}/exams`, { token }).then((d) => d.attempts || []), [token]);

  /* ---- exams (student) ---- */
  const startExam = useCallback((id) => api(`/exams/${id}/start`, { method: "POST", token }), [token]);
  const submitExam = useCallback(async (id, answers) => {
    const d = await api(`/exams/${id}/submit`, { method: "POST", token, body: { answers } });
    setExams((xs) => xs.map((x) => (x.id === id ? { ...x, attempt: { ...(x.attempt || {}), finished_at: 1, score: d.score, total: d.total } } : x)));
    return d;
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

  /* ---- two-factor authentication (any role) ---- */
  const setup2fa = useCallback(() => api("/account/2fa/setup", { method: "POST", token }), [token]);
  const enable2fa = useCallback(async (code) => {
    try { await api("/account/2fa/enable", { method: "POST", token, body: { code } }); setCurrentUser((u) => (u ? { ...u, twoFactor: true } : u)); return { ok: true, msg: "Two-factor authentication is on." }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const disable2fa = useCallback(async (code) => {
    try { await api("/account/2fa/disable", { method: "POST", token, body: { code } }); setCurrentUser((u) => (u ? { ...u, twoFactor: false } : u)); return { ok: true, msg: "Two-factor authentication is off." }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const saveHcaptcha = useCallback(async (fields) => {
    try { const saved = await api("/admin/hcaptcha", { method: "PUT", token, body: fields }); setHcaptchaLocal(saved); return { ok: true, msg: "hCaptcha settings saved." }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const inviteInstructorLogin = useCallback(async (id, username) => {
    try { const d = await api(`/admin/instructors/${id}/invite-login`, { method: "POST", token, body: { username } }); applyAdmin(d); return { ok: true, msg: d.msg, link: d.link, sent: d.sent }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const saveSmtp = useCallback(async (fields) => {
    try {
      const saved = await api("/admin/smtp", { method: "PUT", token, body: fields });
      setSmtpLocal(saved);
      return { ok: true, msg: "SMTP settings saved." };
    } catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const value = {
    ready, currentUser, courses, users, locked, instructors, certificates, exams, brand, smtp, hcaptcha,
    login, register, logout, setBrand,
    setup2fa, enable2fa, disable2fa, saveHcaptcha, inviteInstructorLogin,
    toggleEnrol, addStudent, removeStudent, updateStudent,
    addCourse, updateCourse, deleteCourse, addItem, removeItem, reorderItems,
    addGroup, renameGroup, deleteGroup, reorderGroups,
    addCourseInstructor, removeCourseInstructor, addInstructor, updateInstructor, deleteInstructor,
    issueManyCertificates, unlockCertificate, sendCertificate, adminViewCertificate, adminDownloadCertificate, downloadCertificate,
    fetchCertTemplates, previewCertTemplate,
    createExam, loadExam, updateExam, deleteExam, addExamQuestion, updateExamQuestion, deleteExamQuestion,
    importExamCsv, exportExamCsv, loadStudentExams, startExam, submitExam,
    updateAccount, changePassword, saveSmtp,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
