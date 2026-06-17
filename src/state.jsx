import { createContext, useContext, useState, useEffect, useCallback } from "react";

/* Store backed by the server API (see server.cjs / db.cjs).
   Data is no longer hard-coded in the browser; it lives in the SQLite
   database and is fetched after sign-in. Passwords never reach the client. */

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const TOKEN_KEY = "lms_token";
const DEFAULT_BRAND = { company: "", name: "Learning Portal", logo: "" };

/* "Remember me" stores the token in localStorage (survives browser restarts);
   otherwise sessionStorage (cleared when the browser/tab closes). */
const readToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
const storeToken = (t, remember) => {
  localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
};
const clearToken = () => { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); };

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get("content-type") || "";
  if (res.ok && !ct.includes("application/json")) {
    // A 200 that is not JSON means the SPA fallback answered an unknown API
    // route (server older than the site). Surface it instead of hanging.
    throw new Error("The server is running older code than the site. Restart it (STOP then START) and reload.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}). If this persists, restart the server so new changes load.`);
  return data;
}

export function StoreProvider({ children }) {
  const [token, setToken] = useState(() => readToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [courses, setCourses] = useState({});
  const [users, setUsers] = useState({});
  const [locked, setLocked] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [exams, setExams] = useState([]);
  const [requests, setRequests] = useState([]);
  const [overdue, setOverdue] = useState([]); // admin: students with past-due balances
  const [plans, setPlans] = useState([]); // admin: all payment plans (Payments page)
  const [payments, setPayments] = useState([]); // student: own payment plans
  const [paymentLocked, setPaymentLocked] = useState([]); // student: locked course ids
  const [reminders, setRemindersLocal] = useState({ enabled: false, key: "" }); // admin
  const [brand, setBrandLocal] = useState(DEFAULT_BRAND);
  const [smtp, setSmtpLocal] = useState(null);
  const [captcha, setCaptchaLocal] = useState({ provider: "none", siteKey: "", hasSecretKey: false, enabled: false });
  const [regnum, setRegnumLocal] = useState({ prefix: "", width: 4 });
  const [ready, setReady] = useState(false);

  const applyBootstrap = (data) => {
    setCurrentUser(data.currentUser || null);
    setCourses(data.courses || {});
    setUsers(data.users || {});
    setInstructors(data.instructors || []);
    setCertificates(data.certificates || []);
    setExams(data.exams || []);
    setLocked(data.locked || []);
    setRequests(data.requests || []);
    setOverdue(data.overdue || []);
    setPlans(data.paymentPlans || []);
    setPayments(data.payments || []);
    setPaymentLocked(data.paymentLocked || []);
    if (data.reminders) setRemindersLocal(data.reminders);
    if (data.brand) setBrandLocal({ ...DEFAULT_BRAND, ...data.brand });
    if (data.smtp) setSmtpLocal(data.smtp);
    if (data.captcha) setCaptchaLocal(data.captcha);
    if (data.regnum) setRegnumLocal(data.regnum);
  };
  const applyAdmin = (data) => {
    if (data.courses) setCourses(data.courses);
    if (data.users) setUsers(data.users);
    if (data.instructors) setInstructors(data.instructors);
    if (data.certificates) setCertificates(data.certificates);
    if (data.exams) setExams(data.exams);
    if (data.requests) setRequests(data.requests);
    if (data.overdue) setOverdue(data.overdue);
    if (data.paymentPlans) setPlans(data.paymentPlans);
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
      try { const cfg = await api("/auth-config"); if (alive && cfg.captcha) setCaptchaLocal(cfg.captcha); } catch { /* ignore */ }
      if (token) {
        try {
          const data = await api("/bootstrap", { token });
          if (alive) applyBootstrap(data);
        } catch {
          clearToken();
          if (alive) setToken(null);
        }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password, { code, captcha, remember } = {}) => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, code, captcha, remember }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || "Sign in failed", twoFactor: !!data.twoFactor };
      const { token: t, user } = data;
      storeToken(t, remember);
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

  const requestPasswordReset = useCallback(async (username) => {
    try { const d = await api("/forgot", { method: "POST", body: { username } }); return { ok: true, state: d.state }; }
    catch (e) { return { ok: false, error: e.message }; }
  }, []);
  const resetPassword = useCallback(async (token, password) => {
    try { await api(`/reset/${token}`, { method: "POST", body: { password } }); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  }, []);

  const logout = useCallback(async () => {
    try { if (token) await api("/logout", { method: "POST", token }); } catch { /* ignore */ }
    clearToken();
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

  const addItem = useCallback(async (cid, groupId, bucket, title, url) => {
    try { applyAdmin(await api("/admin/items", { method: "POST", token, body: { courseId: cid, groupId, bucket, title, url } })); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  /* ---- course enrolment requests ---- */
  const requestCourse = useCallback(async (cid) => {
    try { const d = await api(`/courses/${cid}/request`, { method: "POST", token }); setRequests(d.requests || []); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const approveRequest = useCallback(async (id) => {
    applyAdmin(await api(`/admin/requests/${id}/approve`, { method: "POST", token }));
  }, [token]);
  const declineRequest = useCallback(async (id) => {
    applyAdmin(await api(`/admin/requests/${id}/decline`, { method: "POST", token }));
  }, [token]);

  const removeItem = useCallback(async (cid, bucket, itemId) => {
    applyAdmin(await api("/admin/items", { method: "DELETE", token, body: { courseId: cid, bucket, itemId } }));
  }, [token]);

  const reorderItems = useCallback(async (cid, bucket, orderedIds) => {
    applyAdmin(await api("/admin/items/reorder", { method: "POST", token, body: { courseId: cid, bucket, orderedIds } }));
  }, [token]);

  const uploadMaterial = useCallback(async (cid, groupId, file) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/items/upload?courseId=${encodeURIComponent(cid)}&groupId=${groupId}`, {
        method: "POST", headers: { Authorization: "Bearer " + token }, body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      applyAdmin(data);
      return { ok: true };
    } catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const downloadMaterial = useCallback((id, name) => fetchBlobDownload(`/materials/${id}/file`, name || "file"), [token]);

  /* ---- administrator users ---- */
  const fetchAdmins = useCallback(() => api("/admin/admins", { token }).then((d) => d.admins || []), [token]);
  const addAdmin = useCallback(async (fields) => {
    try { const d = await api("/admin/admins", { method: "POST", token, body: fields }); return { ok: true, admins: d.admins }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const deleteAdmin = useCallback(async (id) => {
    try { const d = await api(`/admin/admins/${id}`, { method: "DELETE", token }); return { ok: true, admins: d.admins }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  /* ---- backup & restore ---- */
  const downloadBackup = useCallback((scope) => {
    const ext = scope === "db" ? "sql" : "zip";
    return fetchBlobDownload(`/admin/backup/${scope}`, `lms-${scope}.${ext}`);
  }, [token]);
  const restoreBackup = useCallback(async (scope, file) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/restore/${scope}`, { method: "POST", headers: { Authorization: "Bearer " + token }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Restore failed");
      if (scope !== "files") applyBootstrap(await api("/bootstrap", { token }));
      return { ok: true, msg: data.msg };
    } catch (e) { return { ok: false, msg: e.message }; }
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

  const saveCaptcha = useCallback(async (fields) => {
    try { const saved = await api("/admin/captcha", { method: "PUT", token, body: fields }); setCaptchaLocal(saved); return { ok: true, msg: "Captcha settings saved." }; }
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
  const saveRegnum = useCallback(async (fields) => {
    try {
      const saved = await api("/admin/regnum", { method: "PUT", token, body: fields });
      setRegnumLocal(saved);
      return { ok: true, msg: "Registration number format saved. It applies to new numbers only." };
    } catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const sendTestMail = useCallback(async (to) => {
    try {
      const d = await api("/admin/smtp/test", { method: "POST", token, body: { to } });
      return { ok: true, msg: `Test email sent to ${d.to}. Check the inbox (and spam).` };
    } catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  /* ---- installment payments ---- */
  const fetchStudentPlans = useCallback((id) => api(`/admin/students/${id}/plans`, { token }).then((d) => d.plans || []), [token]);
  const fetchCoursePlan = useCallback((courseId) => api(`/admin/courses/${courseId}/plan`, { token }), [token]);
  const saveCoursePlan = useCallback(async (courseId, fields) => {
    try { const d = await api(`/admin/courses/${courseId}/plan`, { method: "PUT", token, body: fields }); return { ok: true, ...d }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const applyCoursePlan = useCallback(async (courseId) => {
    try { const d = await api(`/admin/courses/${courseId}/plan/apply`, { method: "POST", token }); applyAdmin(d); return { ok: true, applied: d.applied }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const savePlan = useCallback(async (id, courseId, fields) => {
    try { const d = await api(`/admin/students/${id}/plans/${courseId}`, { method: "PUT", token, body: fields }); applyAdmin(d); return { ok: true, plans: d.plans }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const removePlan = useCallback(async (id, courseId) => {
    try { const d = await api(`/admin/students/${id}/plans/${courseId}`, { method: "DELETE", token }); applyAdmin(d); return { ok: true, plans: d.plans }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const addPayment = useCallback(async (planId, fields) => {
    try { const d = await api(`/admin/plans/${planId}/payments`, { method: "POST", token, body: fields }); applyAdmin(d); return { ok: true, plans: d.plans }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const removePayment = useCallback(async (paymentId) => {
    try { const d = await api(`/admin/payments/${paymentId}`, { method: "DELETE", token }); applyAdmin(d); return { ok: true, plans: d.plans }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const lockStudent = useCallback(async (id, locked = true) => {
    try { applyAdmin(await api(`/admin/students/${id}/lock`, { method: "POST", token, body: { locked } })); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const setCourseLock = useCallback(async (id, courseId, locked) => {
    try { applyAdmin(await api(`/admin/students/${id}/courses/${courseId}/lock`, { method: "POST", token, body: { locked } })); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const saveReminders = useCallback(async (enabled) => {
    try { const d = await api("/admin/reminders", { method: "PUT", token, body: { enabled } }); setRemindersLocal(d); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);
  const sendRemindersNow = useCallback(async () => {
    try { const d = await api("/admin/reminders/send", { method: "POST", token }); return { ok: true, ...d }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }, [token]);

  const value = {
    ready, currentUser, courses, users, locked, instructors, certificates, exams, requests, overdue, plans, payments, paymentLocked, reminders, brand, smtp, captcha, regnum,
    login, register, logout, setBrand, requestPasswordReset, resetPassword,
    setup2fa, enable2fa, disable2fa, saveCaptcha, inviteInstructorLogin,
    toggleEnrol, addStudent, removeStudent, updateStudent,
    addCourse, updateCourse, deleteCourse, addItem, removeItem, reorderItems,
    uploadMaterial, downloadMaterial, downloadBackup, restoreBackup,
    fetchAdmins, addAdmin, deleteAdmin,
    addGroup, renameGroup, deleteGroup, reorderGroups,
    requestCourse, approveRequest, declineRequest,
    addCourseInstructor, removeCourseInstructor, addInstructor, updateInstructor, deleteInstructor,
    issueManyCertificates, unlockCertificate, sendCertificate, adminViewCertificate, adminDownloadCertificate, downloadCertificate,
    fetchCertTemplates, previewCertTemplate,
    createExam, loadExam, updateExam, deleteExam, addExamQuestion, updateExamQuestion, deleteExamQuestion,
    importExamCsv, exportExamCsv, loadStudentExams, startExam, submitExam,
    updateAccount, changePassword, saveSmtp, sendTestMail, saveRegnum,
    fetchStudentPlans, savePlan, removePlan, addPayment, removePayment, lockStudent,
    fetchCoursePlan, saveCoursePlan, applyCoursePlan,
    setCourseLock, saveReminders, sendRemindersNow,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
