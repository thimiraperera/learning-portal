/* Production server for cPanel (Passenger).
   Serves the JSON API + the prebuilt frontend in ./dist, with an SPA
   fallback so client-side routes work on refresh / deep links.
   Data lives in MySQL (see db.cjs); credentials come from env vars. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const dbmod = require("./db.cjs");
const { generateCertificate, templatesList, defaultTemplateId } = require("./cert.cjs");
const { q } = dbmod;

const app = express();
app.set("trust proxy", true); // so req.protocol reflects the proxy (https)
app.use(express.json({ limit: "6mb" })); // logo data URLs can be large

const dist = path.join(__dirname, "dist");

/* Send mail via the stored SMTP settings. Returns {sent, reason}. */
async function sendMail(to, subject, html, attachments) {
  const s = await dbmod.getSmtp();
  if (!s.host) return { sent: false, reason: "SMTP is not configured" };
  try {
    const transporter = nodemailer.createTransport({
      host: s.host,
      port: Number(s.port) || 587,
      secure: !!s.useSsl, // true for 465, false uses STARTTLS on 587
      auth: s.username ? { user: s.username, pass: s.password } : undefined,
    });
    const from = s.fromName ? `"${s.fromName}" <${s.fromEmail || s.username}>` : (s.fromEmail || s.username);
    await transporter.sendMail({ from, to, subject, html, attachments });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

async function certPdf(cert) {
  const brand = await dbmod.getBrand();
  return generateCertificate({
    brandName: brand.name, studentName: cert.studentName,
    courseTitle: cert.courseTitle, courseCode: cert.courseCode,
    certNo: cert.cert_no, issuedAt: cert.issued_at,
  }, cert.certTemplate);
}

/* small async wrapper so thrown errors become 500s instead of hanging.
   Passes next through so it works for middleware (auth) and handlers alike. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => {
  console.error(e);
  if (!res.headersSent) res.status(500).json({ error: "Server error" });
});

async function publicUser(u) {
  return {
    name: dbmod.displayName(u),
    firstName: u.first_name || "", lastName: u.last_name || "", nickname: u.nickname || "", phone: u.phone || "", gender: u.gender || "",
    avatar: u.avatar || "",
    email: u.email, username: u.username, role: u.role, status: u.status,
    enrolled: await dbmod.enrolledIds(u.id),
  };
}

const auth = wrap(async (req, res, next) => {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: "Not authenticated" });
  const [[sess]] = await q("SELECT user_id FROM sessions WHERE token=?", [t]);
  const [[u]] = sess ? await q("SELECT * FROM users WHERE id=?", [sess.user_id]) : [[]];
  if (!u) return res.status(401).json({ error: "Not authenticated" });
  req.user = u; req.token = t; next();
});
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  next();
}
async function adminState() {
  return { courses: await dbmod.coursesMap(), users: await dbmod.usersMap(), instructors: await dbmod.instructorsList(), certificates: await dbmod.listCertificates(), exams: await dbmod.examsList() };
}

/* ---- public ---- */
app.get("/api/brand", wrap(async (_req, res) => res.json(await dbmod.getBrand())));

app.post("/api/login", wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password are required." });
  const [[u]] = await q("SELECT * FROM users WHERE lower(username)=lower(?)", [String(username).trim()]);
  if (!u || !bcrypt.compareSync(String(password), u.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const token = crypto.randomBytes(24).toString("hex");
  await q("INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)", [token, u.id, Date.now()]);
  res.json({ token, user: await publicUser(u) });
}));

app.post("/api/logout", auth, wrap(async (req, res) => {
  await q("DELETE FROM sessions WHERE token=?", [req.token]);
  res.json({ ok: true });
}));

/* ---- public registration (invite link) ---- */
app.get("/api/register/:token", wrap(async (req, res) => {
  const invite = await dbmod.getInvite(req.params.token);
  if (!invite) return res.status(404).json({ error: "This registration link is invalid or has already been used." });
  res.json({ name: invite.name, email: invite.email, username: invite.username });
}));

app.post("/api/register/:token", wrap(async (req, res) => {
  const invite = await dbmod.getInvite(req.params.token);
  if (!invite) return res.status(404).json({ error: "This registration link is invalid or has already been used." });
  const name = String(req.body?.name || "").trim();
  const password = String(req.body?.password || "");
  if (!name) return res.status(400).json({ error: "Please confirm your full name." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  await dbmod.completeRegistration(req.params.token, name, bcrypt.hashSync(password, 10));
  res.json({ ok: true });
}));

/* ---- bootstrap ---- */
app.get("/api/bootstrap", auth, wrap(async (req, res) => {
  const u = req.user;
  if (u.role === "admin") {
    res.json({ currentUser: await publicUser(u), brand: await dbmod.getBrand(), smtp: await dbmod.getSmtpForClient(), ...(await adminState()) });
  } else {
    const ids = await dbmod.enrolledIds(u.id);
    res.json({ currentUser: await publicUser(u), courses: await dbmod.coursesMap(ids), locked: await dbmod.lockedCourses(ids), certificates: await dbmod.studentCertificates(u.id), exams: await dbmod.studentExams(u.id), brand: await dbmod.getBrand() });
  }
}));

/* ---- admin: invite a student (sends a registration link, no password set here) ---- */
app.post("/api/admin/students", auth, adminOnly, wrap(async (req, res) => {
  const { name, email, username } = req.body || {};
  const nm = String(name || "").trim();
  const e = String(email || "").trim().toLowerCase();
  const un = String(username || "").trim().toLowerCase();
  if (!nm || !e.includes("@")) return res.status(400).json({ error: "Enter a full name and a valid email." });
  if (!un) return res.status(400).json({ error: "Enter a username." });
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(email)=? OR lower(username)=? LIMIT 1", [e, un]);
  if (clash) return res.status(409).json({ error: "That email or username is already taken." });

  const token = crypto.randomBytes(24).toString("hex");
  await dbmod.inviteStudent({ name: nm, email: e, username: un, token });

  const link = `${req.protocol}://${req.get("host")}/register?token=${token}`;
  const html = `<p>Hello ${nm},</p>
    <p>You have been invited to the learning portal. Click the link below to confirm your details and set your password:</p>
    <p><a href="${link}">${link}</a></p>
    <p>If you did not expect this, you can ignore this email.</p>`;
  const mail = await sendMail(e, "Complete your registration", html);

  res.json({
    ok: true,
    sent: mail.sent,
    link,
    msg: mail.sent ? `Invitation email sent to ${e}.` : `Student invited, but email was not sent (${mail.reason}). Share this link:`,
    ...(await adminState()),
  });
}));

app.delete("/api/admin/students", auth, adminOnly, wrap(async (req, res) => {
  const e = String(req.body?.email || "").trim().toLowerCase();
  const [[u]] = await q("SELECT id FROM users WHERE lower(email)=? AND role='student'", [e]);
  if (u) {
    await q("DELETE FROM enrolments WHERE user_id=?", [u.id]);
    await q("DELETE FROM exam_attempts WHERE user_id=?", [u.id]);
    await q("DELETE FROM users WHERE id=?", [u.id]);
  }
  res.json(await adminState());
}));

app.put("/api/admin/students/:id", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [[u]] = await q("SELECT id FROM users WHERE id=? AND role='student'", [id]);
  if (!u) return res.status(404).json({ error: "Student not found." });
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(email)=? AND id<>?", [email, id]);
  if (clash) return res.status(409).json({ error: "That email is already in use." });
  await dbmod.updateStudentProfile(id, {
    firstName: String(req.body?.firstName || "").trim(),
    lastName: String(req.body?.lastName || "").trim(),
    nickname: String(req.body?.nickname || "").trim(),
    phone: String(req.body?.phone || "").trim(),
    gender: String(req.body?.gender || ""),
    notes: String(req.body?.notes || ""),
    email,
  });
  res.json(await adminState());
}));

/* ---- admin: enrolment toggle ---- */
app.post("/api/admin/enrol", auth, adminOnly, wrap(async (req, res) => {
  const e = String(req.body?.email || "").trim().toLowerCase();
  const cid = String(req.body?.courseId || "");
  const [[u]] = await q("SELECT id FROM users WHERE lower(email)=?", [e]);
  const [[course]] = await q("SELECT id FROM courses WHERE id=?", [cid]);
  if (u && course) {
    const [[has]] = await q("SELECT 1 AS x FROM enrolments WHERE user_id=? AND course_id=?", [u.id, cid]);
    if (has) await q("DELETE FROM enrolments WHERE user_id=? AND course_id=?", [u.id, cid]);
    else await q("INSERT INTO enrolments (user_id,course_id) VALUES (?,?)", [u.id, cid]);
  }
  res.json(await adminState());
}));

/* ---- admin: courses & items ---- */
app.post("/api/admin/courses", auth, adminOnly, wrap(async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!title || !code) return res.status(400).json({ error: "Enter a title and a code." });
  const id = "c" + Date.now().toString(36);
  await q("INSERT INTO courses (id,code,title,instructor,blurb,sessions) VALUES (?,?,?, '', 'Newly created course.', 0)", [id, code, title]);
  res.json(await adminState());
}));

app.put("/api/admin/courses/:id", auth, adminOnly, wrap(async (req, res) => {
  const id = req.params.id;
  const [[c]] = await q("SELECT id FROM courses WHERE id=?", [id]);
  if (!c) return res.status(404).json({ error: "Course not found." });
  const code = String(req.body?.code || "").trim().toUpperCase();
  const title = String(req.body?.title || "").trim();
  if (!code || !title) return res.status(400).json({ error: "Code and title are required." });
  const certTemplate = String(req.body?.certTemplate || "");
  if (certTemplate && !templatesList().some((t) => t.id === certTemplate)) {
    return res.status(400).json({ error: "Unknown certificate template." });
  }
  await dbmod.updateCourse(id, {
    code, title, certTemplate,
    instructor: String(req.body?.instructor || ""),
    blurb: String(req.body?.blurb || ""),
    sessions: Number.parseInt(req.body?.sessions, 10) || 0,
  });
  res.json(await adminState());
}));

app.delete("/api/admin/courses/:id", auth, adminOnly, wrap(async (req, res) => {
  await dbmod.deleteCourse(req.params.id);
  res.json(await adminState());
}));

app.post("/api/admin/courses/:id/instructors", auth, adminOnly, wrap(async (req, res) => {
  if (req.body?.instructorId) await dbmod.addCourseInstructor(req.params.id, req.body.instructorId);
  res.json(await adminState());
}));

app.delete("/api/admin/courses/:id/instructors", auth, adminOnly, wrap(async (req, res) => {
  if (req.body?.instructorId) await dbmod.removeCourseInstructor(req.params.id, req.body.instructorId);
  res.json(await adminState());
}));

/* ---- instructors ---- */
app.post("/api/admin/instructors", auth, adminOnly, wrap(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Instructor name is required." });
  const email = String(req.body?.email || "");
  await dbmod.addInstructor({
    name, email, phone: String(req.body?.phone || ""),
    title: String(req.body?.title || ""), bio: String(req.body?.bio || ""),
    gender: String(req.body?.gender || ""), notes: String(req.body?.notes || ""),
  });
  let mailNote = "";
  if (req.body?.notify && email.includes("@")) {
    const m = await sendMail(email, "You have been added as an instructor",
      `<p>Hello ${name},</p><p>You have been added as an instructor on the learning portal.</p>`);
    mailNote = m.sent ? " Email sent." : ` (email not sent: ${m.reason})`;
  }
  res.json({ ok: true, msg: "Instructor added." + mailNote, ...(await adminState()) });
}));

app.put("/api/admin/instructors/:id", auth, adminOnly, wrap(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Instructor name is required." });
  await dbmod.updateInstructor(req.params.id, {
    name, email: String(req.body?.email || ""), phone: String(req.body?.phone || ""),
    title: String(req.body?.title || ""), bio: String(req.body?.bio || ""),
    gender: String(req.body?.gender || ""), notes: String(req.body?.notes || ""),
  });
  res.json(await adminState());
}));

app.delete("/api/admin/instructors/:id", auth, adminOnly, wrap(async (req, res) => {
  await dbmod.deleteInstructor(req.params.id);
  res.json(await adminState());
}));

/* ---- certificates (admin) ---- */
app.post("/api/admin/certificates/issue-many", auth, adminOnly, wrap(async (req, res) => {
  const pairs = Array.isArray(req.body?.pairs) ? req.body.pairs : [];
  let issued = 0;
  for (const p of pairs) {
    const sid = Number(p.studentId);
    const cid = String(p.courseId || "");
    const [[stu]] = await q("SELECT * FROM users WHERE id=? AND role='student'", [sid]);
    const [[course]] = await q("SELECT * FROM courses WHERE id=?", [cid]);
    if (!stu || !course || await dbmod.certExists(sid, cid)) continue;
    // First issue for a course locks in the default template so future
    // certificates for that course keep using the same design.
    if (!course.cert_template && defaultTemplateId()) {
      course.cert_template = defaultTemplateId();
      await q("UPDATE courses SET cert_template=? WHERE id=?", [course.cert_template, cid]);
    }
    const certNo = "CERT-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    await dbmod.issueCertificate(sid, cid, certNo, Date.now());
    await sendMail(stu.email, "Your certificate has been issued",
      `<p>Hello ${dbmod.displayName(stu)},</p><p>Your certificate for <strong>${course.title}</strong> has been issued. You can download it from your dashboard.</p>`);
    issued++;
  }
  res.json({ ok: true, msg: `Issued ${issued} certificate${issued === 1 ? "" : "s"}.`, ...(await adminState()) });
}));

app.get("/api/admin/certificates/:id/pdf", auth, adminOnly, wrap(async (req, res) => {
  const cert = await dbmod.getCertificate(Number(req.params.id));
  if (!cert) return res.status(404).json({ error: "Certificate not found." });
  const pdf = await certPdf(cert);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${cert.cert_no}.pdf"`);
  res.send(pdf);
}));

app.post("/api/admin/certificates/:id/send", auth, adminOnly, wrap(async (req, res) => {
  const cert = await dbmod.getCertificate(Number(req.params.id));
  if (!cert) return res.status(404).json({ error: "Certificate not found." });
  const pdf = await certPdf(cert);
  const mail = await sendMail(cert.studentEmail, `Your certificate: ${cert.courseTitle}`,
    `<p>Hello ${cert.studentName},</p><p>Attached is your certificate for <strong>${cert.courseTitle}</strong>.</p>`,
    [{ filename: `${cert.cert_no}.pdf`, content: pdf }]);
  res.json({ ok: mail.sent, msg: mail.sent ? `Certificate emailed to ${cert.studentEmail}.` : `Not sent: ${mail.reason}` });
}));

app.post("/api/admin/certificates/:id/unlock", auth, adminOnly, wrap(async (req, res) => {
  await dbmod.unlockCertificate(Number(req.params.id));
  res.json({ ok: true, ...(await adminState()) });
}));

/* ---- certificates (student, one-time download) ---- */
app.get("/api/certificates/:id/download", auth, wrap(async (req, res) => {
  const cert = await dbmod.getCertificate(Number(req.params.id));
  if (!cert || cert.student_id !== req.user.id) return res.status(404).json({ error: "Certificate not found." });
  if (cert.downloaded && !cert.unlocked) return res.status(403).json({ error: "You have already downloaded this certificate. Ask your administrator to unlock it if you need it again." });
  const pdf = await certPdf(cert);
  await dbmod.markCertDownloaded(cert.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${cert.cert_no}.pdf"`);
  res.send(pdf);
}));

/* ---- certificate templates (admin) ---- */
app.get("/api/admin/cert-templates", auth, adminOnly, wrap(async (_req, res) => {
  res.json({ templates: templatesList(), defaultId: defaultTemplateId() });
}));

app.get("/api/admin/cert-templates/:id/preview", auth, adminOnly, wrap(async (req, res) => {
  if (!templatesList().some((t) => t.id === req.params.id)) return res.status(404).json({ error: "Template not found." });
  const brand = await dbmod.getBrand();
  const pdf = await generateCertificate({
    brandName: brand.name, studentName: "Student Name",
    courseTitle: "Sample Course Title", courseCode: "SC-100",
    certNo: "CERT-SAMPLE", issuedAt: Date.now(),
  }, req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="template-${req.params.id}.pdf"`);
  res.send(pdf);
}));

/* ---- exams (admin) ---- */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Minimal CSV reader that understands quoted fields. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
function questionsFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { questions: [], errors: ["The file has no data rows."] };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const qi = head.indexOf("question");
  const ci = head.indexOf("correct");
  const oi = OPTION_LETTERS.map((L) => head.indexOf("option_" + L.toLowerCase()));
  if (qi === -1 || ci === -1 || oi[0] === -1 || oi[1] === -1) {
    return { questions: [], errors: ["The header row must contain: question, option_a, option_b (up to option_f) and correct."] };
  }
  const questions = [], errors = [];
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const question = (r[qi] || "").trim();
    const options = oi.filter((i) => i !== -1).map((i) => (r[i] || "").trim()).filter(Boolean);
    const letters = ((r[ci] || "").toUpperCase().match(/[A-F]/g)) || [];
    const corrects = [...new Set(letters.map((L) => OPTION_LETTERS.indexOf(L)))].sort((a, b) => a - b);
    if (!question) { errors.push(`Line ${line}: question is empty.`); return; }
    if (options.length < 2) { errors.push(`Line ${line}: at least two options are required.`); return; }
    if (corrects.length === 0 || corrects.some((c) => c >= options.length)) {
      errors.push(`Line ${line}: correct must use letters between A and ${OPTION_LETTERS[options.length - 1]} (several letters make it a checkbox question).`);
      return;
    }
    questions.push({ question, options, qtype: corrects.length > 1 ? "multi" : "single", corrects });
  });
  return { questions, errors };
}

/* One mark per question. Checkbox questions earn partial marks
   (right picks minus wrong picks over the number of right answers),
   clamped at zero so no question, and so no paper, can go negative. */
function gradeAttempt(snapQuestions, answers) {
  let score = 0;
  snapQuestions.forEach((qq, i) => {
    const corrects = qq.corrects || [qq.correct];
    if ((qq.qtype || "single") === "multi") {
      const sel = Array.isArray(answers[i]) ? [...new Set(answers[i].map(Number))] : [];
      const right = sel.filter((x) => corrects.includes(x)).length;
      const wrong = sel.length - right;
      score += Math.max(0, (right - wrong) / corrects.length);
    } else if (answers[i] != null && Number(answers[i]) === corrects[0]) {
      score += 1;
    }
  });
  return Math.round(score * 100) / 100;
}

function cleanQuestion(body) {
  const question = String(body?.question || "").trim();
  const options = (Array.isArray(body?.options) ? body.options : []).map((o) => String(o || "").trim()).filter(Boolean);
  const qtype = body?.qtype === "multi" ? "multi" : "single";
  const raw = Array.isArray(body?.corrects) ? body.corrects : [body?.correct];
  const corrects = [...new Set(raw.map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 0 && n < options.length)
    .sort((a, b) => a - b);
  if (!question) return { error: "Enter the question text." };
  if (options.length < 2 || options.length > 6) return { error: "Provide between 2 and 6 answer options." };
  if (corrects.length === 0) return { error: "Mark which option is correct." };
  if (qtype === "single" && corrects.length !== 1) return { error: "A single-answer question needs exactly one correct option." };
  return { question, options, qtype, corrects };
}

app.post("/api/admin/exams", auth, adminOnly, wrap(async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Enter an exam title." });
  const courseId = String(req.body?.courseId || "");
  if (courseId) {
    const [[c]] = await q("SELECT id FROM courses WHERE id=?", [courseId]);
    if (!c) return res.status(400).json({ error: "Pick a valid course." });
  }
  const [r] = await q("INSERT INTO exams (course_id,title,question_count,time_limit,created_at) VALUES (?,?,0,0,?)", [courseId, title, Date.now()]);
  res.json({ ok: true, examId: r.insertId, ...(await adminState()) });
}));

app.get("/api/admin/exams/:id", auth, adminOnly, wrap(async (req, res) => {
  const exam = await dbmod.examFull(Number(req.params.id));
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  res.json({ exam });
}));

app.put("/api/admin/exams/:id", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await dbmod.examMeta(id))) return res.status(404).json({ error: "Exam not found." });
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Enter an exam title." });
  const courseId = String(req.body?.courseId || "");
  if (courseId) {
    const [[c]] = await q("SELECT id FROM courses WHERE id=?", [courseId]);
    if (!c) return res.status(400).json({ error: "Pick a valid course." });
  }
  const questionCount = Math.max(0, Number.parseInt(req.body?.questionCount, 10) || 0);
  const timeLimit = Math.max(0, Number.parseInt(req.body?.timeLimit, 10) || 0);
  await q("UPDATE exams SET title=?, course_id=?, question_count=?, time_limit=? WHERE id=?", [title, courseId, questionCount, timeLimit, id]);
  res.json({ exam: await dbmod.examFull(id), ...(await adminState()) });
}));

app.delete("/api/admin/exams/:id", auth, adminOnly, wrap(async (req, res) => {
  await dbmod.deleteExam(Number(req.params.id));
  res.json(await adminState());
}));

app.post("/api/admin/exams/:id/questions", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await dbmod.examMeta(id))) return res.status(404).json({ error: "Exam not found." });
  const c = cleanQuestion(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  await dbmod.addExamQuestion(id, c.question, c.options, c.qtype, c.corrects);
  res.json({ exam: await dbmod.examFull(id), ...(await adminState()) });
}));

app.put("/api/admin/exams/:id/questions/:qid", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const c = cleanQuestion(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  await dbmod.updateExamQuestion(id, Number(req.params.qid), c.question, c.options, c.qtype, c.corrects);
  res.json({ exam: await dbmod.examFull(id), ...(await adminState()) });
}));

app.delete("/api/admin/exams/:id/questions/:qid", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  await dbmod.deleteExamQuestion(id, Number(req.params.qid));
  res.json({ exam: await dbmod.examFull(id), ...(await adminState()) });
}));

app.post("/api/admin/exams/:id/import", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await dbmod.examMeta(id))) return res.status(404).json({ error: "Exam not found." });
  const { questions, errors } = questionsFromCsv(String(req.body?.csv || ""));
  if (questions.length === 0) {
    return res.status(400).json({ error: "No questions could be imported.", errors });
  }
  if (req.body?.mode === "replace") await dbmod.clearExamQuestions(id);
  for (const qn of questions) await dbmod.addExamQuestion(id, qn.question, qn.options, qn.qtype, qn.corrects);
  res.json({ ok: true, imported: questions.length, errors, exam: await dbmod.examFull(id), ...(await adminState()) });
}));

app.get("/api/admin/exams/:id/export", auth, adminOnly, wrap(async (req, res) => {
  const exam = await dbmod.examFull(Number(req.params.id));
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const cell = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = ["question,option_a,option_b,option_c,option_d,option_e,option_f,correct"];
  for (const qn of exam.questions) {
    const opts = OPTION_LETTERS.map((_, i) => cell(qn.options[i] || ""));
    lines.push([cell(qn.question), ...opts, qn.corrects.map((c) => OPTION_LETTERS[c]).join(";")].join(","));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="exam-${exam.id}.csv"`);
  res.send(lines.join("\r\n") + "\r\n");
}));

app.get("/api/admin/students/:id/exams", auth, adminOnly, wrap(async (req, res) => {
  res.json({ attempts: await dbmod.studentAttemptsAdmin(Number(req.params.id)) });
}));

/* ---- exams (student) ---- */
app.post("/api/exams/:id/start", auth, wrap(async (req, res) => {
  const eid = Number(req.params.id);
  const exam = await dbmod.examMeta(eid);
  if (!exam || !exam.course_id) return res.status(404).json({ error: "Exam not found." });
  const enrolled = await dbmod.enrolledIds(req.user.id);
  if (!enrolled.includes(exam.course_id)) return res.status(403).json({ error: "You are not enrolled in this course." });
  const [bank] = await q("SELECT id, question, options, correct, qtype, corrects FROM exam_questions WHERE exam_id=?", [eid]);
  if (bank.length === 0) return res.status(400).json({ error: "This exam has no questions yet." });

  const limitMs = exam.time_limit > 0 ? exam.time_limit * 60000 : 0;
  let attempt = await dbmod.latestAttempt(eid, req.user.id);

  // An unfinished attempt whose time ran out is closed with no answers.
  if (attempt && !attempt.finished_at && limitMs && Date.now() > attempt.started_at + limitMs + 30000) {
    const snap = JSON.parse(attempt.snapshot);
    await dbmod.finishAttempt(attempt.id, 0, snap.questions.length, []);
    attempt = await dbmod.latestAttempt(eid, req.user.id);
  }
  const meta = { title: exam.title, courseId: exam.course_id, courseTitle: exam.courseTitle, courseCode: exam.courseCode };
  if (attempt && attempt.finished_at) {
    return res.json({ finished: true, score: attempt.score, total: attempt.total, ...meta });
  }

  let snap;
  if (attempt) {
    snap = JSON.parse(attempt.snapshot);
  } else {
    // Draw a random subset of the bank and shuffle each question's answers.
    const pool = shuffle(bank.slice());
    const count = exam.question_count > 0 ? Math.min(exam.question_count, pool.length) : pool.length;
    const qs = pool.slice(0, count).map((row) => {
      const opts = JSON.parse(row.options).map((text, i) => ({ text, i }));
      shuffle(opts);
      const corrects = row.corrects ? JSON.parse(row.corrects) : [row.correct];
      return {
        qid: row.id, qtype: row.qtype || "single", question: row.question,
        options: opts.map((o) => o.text),
        corrects: opts.map((o, ni) => (corrects.includes(o.i) ? ni : -1)).filter((x) => x !== -1),
      };
    });
    snap = { questions: qs };
    attempt = await dbmod.createAttempt(eid, req.user.id, Date.now(), JSON.stringify(snap));
  }
  res.json({
    ...meta,
    timeLimit: exam.time_limit, startedAt: attempt.started_at,
    endsAt: limitMs ? attempt.started_at + limitMs : null,
    questions: snap.questions.map((qq) => ({ question: qq.question, options: qq.options, qtype: qq.qtype || "single" })),
  });
}));

app.post("/api/exams/:id/submit", auth, wrap(async (req, res) => {
  const eid = Number(req.params.id);
  const exam = await dbmod.examMeta(eid);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const attempt = await dbmod.latestAttempt(eid, req.user.id);
  if (!attempt) return res.status(400).json({ error: "Start the exam first." });
  if (attempt.finished_at) return res.json({ finished: true, score: attempt.score, total: attempt.total });
  const snap = JSON.parse(attempt.snapshot);
  const limitMs = exam.time_limit > 0 ? exam.time_limit * 60000 : 0;
  const expired = limitMs && Date.now() > attempt.started_at + limitMs + 30000;
  const answers = expired ? [] : (Array.isArray(req.body?.answers) ? req.body.answers : []);
  const score = gradeAttempt(snap.questions, answers);
  await dbmod.finishAttempt(attempt.id, score, snap.questions.length, answers);
  res.json({ finished: true, score, total: snap.questions.length });
}));

const BUCKET = { recordings: "recordings", links: "links", materials: "materials" };
app.post("/api/admin/items", auth, adminOnly, wrap(async (req, res) => {
  const { courseId, bucket, value } = req.body || {};
  const v = String(value || "").trim();
  if (!BUCKET[bucket] || !v) return res.status(400).json({ error: "Invalid item." });
  await dbmod.addCourseItem(courseId, bucket, v);
  res.json(await adminState());
}));

app.delete("/api/admin/items", auth, adminOnly, wrap(async (req, res) => {
  const { courseId, bucket, itemId } = req.body || {};
  if (!BUCKET[bucket]) return res.status(400).json({ error: "Invalid bucket." });
  await dbmod.removeCourseItem(courseId, bucket, itemId);
  res.json(await adminState());
}));

app.post("/api/admin/items/reorder", auth, adminOnly, wrap(async (req, res) => {
  const { courseId, bucket, orderedIds } = req.body || {};
  if (!BUCKET[bucket] || !Array.isArray(orderedIds)) return res.status(400).json({ error: "Invalid reorder." });
  await dbmod.reorderItems(courseId, bucket, orderedIds);
  res.json(await adminState());
}));

/* ---- account self-service (any signed-in user; username cannot change) ---- */
app.put("/api/account", auth, wrap(async (req, res) => {
  const { firstName, lastName, nickname, email, phone, gender } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  if (!e.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(email)=? AND id<>?", [e, req.user.id]);
  if (clash) return res.status(409).json({ error: "That email is already in use." });
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  const nick = String(nickname || "").trim();
  const ph = String(phone || "").trim();
  const g = String(gender || "");
  const name = nick || [first, last].filter(Boolean).join(" ") || req.user.username;
  await q("UPDATE users SET first_name=?, last_name=?, nickname=?, phone=?, gender=?, email=?, name=? WHERE id=?", [first, last, nick, ph, g, e, name, req.user.id]);
  if (req.body?.avatar !== undefined) await q("UPDATE users SET avatar=? WHERE id=?", [String(req.body.avatar || ""), req.user.id]);
  const [[u]] = await q("SELECT * FROM users WHERE id=?", [req.user.id]);
  res.json({ user: await publicUser(u) });
}));

app.post("/api/account/password", auth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!bcrypt.compareSync(String(currentPassword || ""), req.user.password_hash)) {
    return res.status(400).json({ error: "Your current password is incorrect." });
  }
  if (String(newPassword || "").length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });
  await q("UPDATE users SET password_hash=? WHERE id=?", [bcrypt.hashSync(String(newPassword), 10), req.user.id]);
  res.json({ ok: true });
}));

/* ---- SMTP settings (admins) ---- */
app.put("/api/admin/smtp", auth, adminOnly, wrap(async (req, res) => {
  const b = req.body || {};
  res.json(await dbmod.setSmtp({
    host: String(b.host || ""), port: String(b.port || ""),
    username: String(b.username || ""), password: b.password === undefined ? "" : String(b.password),
    fromEmail: String(b.fromEmail || ""), fromName: String(b.fromName || ""),
    useTls: !!b.useTls, useSsl: !!b.useSsl,
  }));
}));

/* ---- branding ---- */
app.put("/api/brand", auth, adminOnly, wrap(async (req, res) => {
  const brand = {
    company: String(req.body?.company || ""),
    name: String(req.body?.name || ""),
    logo: String(req.body?.logo || ""),
  };
  res.json(await dbmod.setBrandValue(brand));
}));

/* ---- static build + SPA fallback ---- */
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = process.env.PORT || 3000;
dbmod.init()
  .then(() => app.listen(port, () => console.log("Learning Portal listening on port " + port)))
  .catch((e) => { console.error("Database init failed:", e.message); process.exit(1); });
