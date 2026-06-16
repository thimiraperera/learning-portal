/* Production server for cPanel (Passenger).
   Serves the JSON API + the prebuilt frontend in ./dist, with an SPA
   fallback so client-side routes work on refresh / deep links.
   Data lives in MySQL (see db.cjs); credentials come from env vars. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const fs = require("fs");
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const multer = require("multer");
const AdmZip = require("adm-zip");
const dbmod = require("./db.cjs");
const { generateCertificate, templatesList, defaultTemplateId } = require("./cert.cjs");
const totp = require("./totp.cjs");
const mailer = require("./email.cjs");
const { q } = dbmod;

const BRAND_ISSUER = "Learning Portal";

/* Build a branded HTML email (pulls the portal name from saved branding). */
async function emailHtml(title, subtitle, body) {
  const brand = await dbmod.getBrand();
  return mailer.wrap({ brandName: brand.name, title, subtitle, body });
}

/* Verify an hCaptcha token against the configured secret. Returns true when
   hCaptcha is disabled (nothing to check). */
async function checkCaptcha(token) {
  const cfg = await dbmod.getHcaptcha();
  if (!cfg.enabled || !cfg.siteKey || !cfg.secretKey) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: cfg.secretKey, response: String(token) });
    const r = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const d = await r.json();
    return !!d.success;
  } catch {
    return false;
  }
}

const app = express();
app.set("trust proxy", true); // so req.protocol reflects the proxy (https)
app.use(express.json({ limit: "6mb" })); // logo data URLs can be large

const dist = path.join(__dirname, "dist");
const STORAGE = path.join(__dirname, "storage");
fs.mkdirSync(STORAGE, { recursive: true });

/* Course files are stored under storage/<course-code>/ so they are easy to
   browse and back up over FTP. */
const safeName = (s) => String(s || "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_") || "file";
function humanSize(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + " MB";
  return (b / 1024 / 1024 / 1024).toFixed(1) + " GB";
}

const materialStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    (async () => {
      const [[c]] = await q("SELECT code FROM courses WHERE id=?", [String(req.query.courseId || "")]);
      if (!c) return cb(new Error("Course not found"));
      const dir = path.join(STORAGE, safeName(c.code));
      await fs.promises.mkdir(dir, { recursive: true });
      cb(null, dir);
    })().catch(cb);
  },
  filename: (_req, file, cb) => cb(null, Date.now() + "-" + crypto.randomBytes(3).toString("hex") + "-" + safeName(file.originalname)),
});
const uploadMaterial = multer({ storage: materialStorage, limits: { fileSize: 500 * 1024 * 1024 } });
const uploadBackup = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } });

async function userCanAccessCourse(user, courseId) {
  if (user.role === "admin") return true;
  if (user.role === "instructor") return dbmod.instructorTeaches(user.id, courseId);
  return (await dbmod.enrolledIds(user.id)).includes(courseId);
}

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
    twoFactor: !!u.totp_enabled,
    regNo: u.reg_no || "",
    enrolled: await dbmod.enrolledIds(u.id),
  };
}

const auth = wrap(async (req, res, next) => {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: "Not authenticated" });
  const [[sess]] = await q("SELECT user_id, expires_at FROM sessions WHERE token=?", [t]);
  if (sess && sess.expires_at && Date.now() > Number(sess.expires_at)) {
    await q("DELETE FROM sessions WHERE token=?", [t]);
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
  const [[u]] = sess ? await q("SELECT * FROM users WHERE id=?", [sess.user_id]) : [[]];
  if (!u) return res.status(401).json({ error: "Not authenticated" });
  req.user = u; req.token = t; next();
});
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  next();
}
async function adminState() {
  return { courses: await dbmod.coursesMap(), users: await dbmod.usersMap(), instructors: await dbmod.instructorsList(), certificates: await dbmod.listCertificates(), exams: await dbmod.examsList(), requests: await dbmod.pendingRequests(), overdue: await dbmod.overduePayments(), paymentPlans: await dbmod.allPlans() };
}

/* ---- public ---- */
app.get("/api/brand", wrap(async (_req, res) => res.json(await dbmod.getBrand())));
app.get("/api/auth-config", wrap(async (_req, res) => res.json({ hcaptcha: await dbmod.getHcaptchaForClient() })));

/* ---- first-admin setup (only works while no admin exists) ---- */
app.get("/api/setup/needed", wrap(async (_req, res) => res.json({ needed: !(await dbmod.hasAdmin()) })));

app.post("/api/setup/admin", wrap(async (req, res) => {
  if (await dbmod.hasAdmin()) return res.status(403).json({ error: "An administrator already exists. Please sign in." });
  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim().toLowerCase();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!name) return res.status(400).json({ error: "Enter a full name." });
  if (!username) return res.status(400).json({ error: "Enter a username." });
  if (!email.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(username)=? OR lower(email)=? LIMIT 1", [username, email]);
  if (clash) return res.status(409).json({ error: "That username or email is already in use." });
  await dbmod.createAdmin({ name, username, email, password });
  res.json({ ok: true });
}));

app.post("/api/login", wrap(async (req, res) => {
  const { username, password, code, captcha, remember } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password are required." });
  if (!(await checkCaptcha(captcha))) return res.status(400).json({ error: "Captcha verification failed. Please try again." });
  const idv = String(username).trim().toLowerCase();
  const [[u]] = await q("SELECT * FROM users WHERE lower(username)=? OR lower(email)=? LIMIT 1", [idv, idv]);
  if (!u || !bcrypt.compareSync(String(password), u.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  if (u.status === "inactive") {
    return res.status(403).json({ error: "This account is inactive. Please contact your administrator." });
  }
  if (u.totp_enabled) {
    if (!code) return res.status(401).json({ twoFactor: true, error: "Enter the 6-digit code from your authenticator app." });
    if (!totp.verify(u.totp_secret, code)) return res.status(401).json({ twoFactor: true, error: "That code is not valid. Try again." });
  }
  const token = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  // "Remember me" keeps the session for 30 days; otherwise it lapses in a day.
  const expires = now + (remember ? 30 : 1) * 24 * 60 * 60 * 1000;
  await q("INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)", [token, u.id, now, expires]);
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
  if (!(await checkCaptcha(req.body?.captcha))) return res.status(400).json({ error: "Captcha verification failed. Please try again." });
  const firstName = String(req.body?.firstName || "").trim();
  const lastName = String(req.body?.lastName || "").trim();
  const name = String(req.body?.name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const gender = String(req.body?.gender || "").trim();
  const password = String(req.body?.password || "");
  if (!firstName) return res.status(400).json({ error: "Enter your first name." });
  if (!lastName) return res.status(400).json({ error: "Enter your last name." });
  if (!name) return res.status(400).json({ error: "Confirm your full name (used on certificates)." });
  if (!phone) return res.status(400).json({ error: "Enter your phone number." });
  if (!gender) return res.status(400).json({ error: "Select your gender." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  await dbmod.completeRegistration(req.params.token, { name, firstName, lastName, phone, gender }, bcrypt.hashSync(password, 10));
  res.json({ ok: true });
}));

/* ---- forgot / reset password (public) ---- */
app.post("/api/forgot", wrap(async (req, res) => {
  const id = String(req.body?.username || "").trim();
  if (!id) return res.status(400).json({ error: "Enter your username or email." });
  const u = await dbmod.findLoginUser(id);
  // Unknown account: respond generically so we don't reveal who exists.
  if (!u) return res.json({ state: "sent" });
  if (!u.email || !u.email.includes("@")) return res.json({ state: "noemail" });
  const token = crypto.randomBytes(24).toString("hex");
  await dbmod.setResetToken(u.id, token, Date.now() + 60 * 60 * 1000); // 1 hour
  const link = `${req.protocol}://${req.get("host")}/reset?token=${token}`;
  const html = await emailHtml("Reset your password", "Password reset request",
    mailer.paragraph(`Hello <strong>${mailer.esc(dbmod.displayName(u))}</strong>,`) +
    mailer.statusBox("We received a request to reset your password. This link expires in 1 hour.", "info") +
    mailer.button("Reset password", link) +
    mailer.muted("If the button does not work, copy and paste this link:") + mailer.linkBox(link) +
    mailer.muted("If you did not request this, you can safely ignore this email."));
  const mail = await sendMail(u.email, "Reset your password", html);
  res.json({ state: mail.sent ? "sent" : "nomail_config" });
}));

app.get("/api/reset/:token", wrap(async (req, res) => {
  const u = await dbmod.getResetUser(req.params.token);
  if (!u) return res.status(404).json({ error: "This reset link is invalid or has expired." });
  res.json({ ok: true, name: u.name });
}));

app.post("/api/reset/:token", wrap(async (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  const ok = await dbmod.applyReset(req.params.token, bcrypt.hashSync(password, 10));
  if (!ok) return res.status(404).json({ error: "This reset link is invalid or has expired." });
  res.json({ ok: true });
}));

/* ---- bootstrap ---- */
app.get("/api/bootstrap", auth, wrap(async (req, res) => {
  const u = req.user;
  if (u.role === "admin") {
    res.json({ currentUser: await publicUser(u), brand: await dbmod.getBrand(), smtp: await dbmod.getSmtpForClient(), hcaptcha: await dbmod.getHcaptchaForClient(), regnum: await dbmod.getRegConfigForClient(), ...(await adminState()) });
  } else if (u.role === "instructor") {
    const ins = await dbmod.instructorByUserId(u.id);
    res.json({ currentUser: await publicUser(u), courses: ins ? await dbmod.coursesForInstructor(ins.id) : {}, brand: await dbmod.getBrand() });
  } else {
    const ids = await dbmod.enrolledIds(u.id);
    res.json({ currentUser: await publicUser(u), courses: await dbmod.coursesMap(ids), locked: await dbmod.lockedCourses(ids), certificates: await dbmod.studentCertificates(u.id), exams: await dbmod.studentExams(u.id), requests: await dbmod.studentRequestIds(u.id), payments: await dbmod.studentPlans(u.id), brand: await dbmod.getBrand() });
  }
}));

/* ---- student: request enrolment in a course ---- */
app.post("/api/courses/:id/request", auth, wrap(async (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only." });
  const cid = req.params.id;
  const [[c]] = await q("SELECT id FROM courses WHERE id=?", [cid]);
  if (!c) return res.status(404).json({ error: "Course not found." });
  if ((await dbmod.enrolledIds(req.user.id)).includes(cid)) return res.status(400).json({ error: "You are already enrolled in this course." });
  await dbmod.createRequest(req.user.id, cid);
  res.json({ ok: true, requests: await dbmod.studentRequestIds(req.user.id) });
}));

/* ---- admin: enrolment requests ---- */
app.post("/api/admin/requests/:id/approve", auth, adminOnly, wrap(async (req, res) => {
  const r = await dbmod.getRequest(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "Request not found." });
  await q("INSERT IGNORE INTO enrolments (user_id,course_id) VALUES (?,?)", [r.user_id, r.course_id]);
  await dbmod.deleteRequest(r.id);
  res.json(await adminState());
}));

app.post("/api/admin/requests/:id/decline", auth, adminOnly, wrap(async (req, res) => {
  await dbmod.deleteRequest(Number(req.params.id));
  res.json(await adminState());
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
  const html = await emailHtml("Complete your registration", "You have been invited to the learning portal",
    mailer.paragraph(`Hello <strong>${mailer.esc(nm)}</strong>,`) +
    mailer.statusBox("You've been invited as a student. Confirm your details and set a password to activate your account.", "info") +
    mailer.button("Complete registration", link) +
    mailer.muted("If the button does not work, copy and paste this link:") + mailer.linkBox(link) +
    mailer.muted("If you did not expect this email, you can safely ignore it."));
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
    await q("DELETE FROM payments WHERE plan_id IN (SELECT id FROM payment_plans WHERE user_id=?)", [u.id]);
    await q("DELETE FROM payment_plans WHERE user_id=?", [u.id]);
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
  const gender = String(req.body?.gender || "");
  if (!gender) return res.status(400).json({ error: "Select a gender." });
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(email)=? AND id<>?", [email, id]);
  if (clash) return res.status(409).json({ error: "That email is already in use." });
  await dbmod.updateStudentProfile(id, {
    firstName: String(req.body?.firstName || "").trim(),
    lastName: String(req.body?.lastName || "").trim(),
    nickname: String(req.body?.nickname || "").trim(),
    phone: String(req.body?.phone || "").trim(),
    gender,
    notes: String(req.body?.notes || ""),
    nic: String(req.body?.nic || "").trim(),
    status: String(req.body?.status || ""),
    email,
  });
  res.json(await adminState());
}));

/* ---- admin: lock a student (manual, never automatic) ---- */
app.post("/api/admin/students/:id/lock", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  await q("UPDATE users SET status='inactive' WHERE id=? AND role='student' AND status<>'invited'", [id]);
  res.json(await adminState());
}));

/* ---- admin: installment payment plans ---- */
app.get("/api/admin/students/:id/plans", auth, adminOnly, wrap(async (req, res) => {
  res.json({ plans: await dbmod.studentPlans(Number(req.params.id)) });
}));

app.put("/api/admin/students/:id/plans/:courseId", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const cid = String(req.params.courseId);
  const [[u]] = await q("SELECT id FROM users WHERE id=? AND role='student'", [id]);
  if (!u) return res.status(404).json({ error: "Student not found." });
  const [[has]] = await q("SELECT 1 AS x FROM enrolments WHERE user_id=? AND course_id=?", [id, cid]);
  if (!has) return res.status(400).json({ error: "Enrol the student in this course before setting a payment plan." });
  const totalFee = Math.max(0, Number(req.body?.totalFee) || 0);
  const regFee = Math.max(0, Number(req.body?.regFee) || 0);
  const dueDate = String(req.body?.dueDate || "").slice(0, 20);
  await dbmod.upsertPlan(id, cid, { totalFee, regFee, dueDate });
  res.json({ plans: await dbmod.studentPlans(id), ...(await adminState()) });
}));

app.delete("/api/admin/students/:id/plans/:courseId", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  await dbmod.deletePlan(id, String(req.params.courseId));
  res.json({ plans: await dbmod.studentPlans(id), ...(await adminState()) });
}));

app.post("/api/admin/plans/:planId/payments", auth, adminOnly, wrap(async (req, res) => {
  const planId = Number(req.params.planId);
  const plan = await dbmod.planById(planId);
  if (!plan) return res.status(404).json({ error: "Payment plan not found." });
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Enter a payment amount greater than zero." });
  const note = String(req.body?.note || "").slice(0, 255);
  const paidAt = Number(req.body?.paidAt) || Date.now();
  await dbmod.addPayment(planId, amount, note, paidAt);
  res.json({ plans: await dbmod.studentPlans(plan.user_id), ...(await adminState()) });
}));

app.delete("/api/admin/payments/:paymentId", auth, adminOnly, wrap(async (req, res) => {
  const pid = Number(req.params.paymentId);
  const userId = await dbmod.paymentOwnerUser(pid);
  await dbmod.deletePayment(pid);
  res.json({ plans: userId ? await dbmod.studentPlans(userId) : [], ...(await adminState()) });
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
    await dbmod.clearRequest(u.id, cid); // resolve any pending request for this pair
  }
  res.json(await adminState());
}));

/* ---- admin: courses & items ---- */
app.post("/api/admin/courses", auth, adminOnly, wrap(async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!title || !code) return res.status(400).json({ error: "Enter a title and a code." });
  const blurb = String(req.body?.blurb || "").trim() || "Newly created course.";
  const sessions = Number.parseInt(req.body?.sessions, 10) || 0;
  const certTemplate = String(req.body?.certTemplate || "");
  if (certTemplate && !templatesList().some((t) => t.id === certTemplate)) {
    return res.status(400).json({ error: "Unknown certificate template." });
  }
  const instructorIds = (Array.isArray(req.body?.instructorIds) ? req.body.instructorIds : []).map(Number).filter(Boolean);
  if (instructorIds.length === 0) return res.status(400).json({ error: "Assign at least one instructor to the course." });
  const id = "c" + Date.now().toString(36);
  await q("INSERT INTO courses (id,code,title,instructor,blurb,sessions,cert_template) VALUES (?,?,?, '', ?, ?, ?)", [id, code, title, blurb, sessions, certTemplate]);
  for (const iid of instructorIds) await dbmod.addCourseInstructor(id, iid);
  res.json({ ok: true, courseId: id, ...(await adminState()) });
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
  await removeFiles(await dbmod.courseMaterialFiles(req.params.id, null));
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
  if (!name) return res.status(400).json({ error: "Enter the instructor's full name." });
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Enter a title or role for the instructor." });
  const email = String(req.body?.email || "").trim();
  if (!email.includes("@")) return res.status(400).json({ error: "Enter a valid email address." });
  await dbmod.addInstructor({
    name, email, phone: String(req.body?.phone || ""),
    title: String(req.body?.title || ""), bio: String(req.body?.bio || ""),
    gender: String(req.body?.gender || ""), notes: String(req.body?.notes || ""),
  });
  let mailNote = "";
  if (req.body?.notify && email.includes("@")) {
    const html = await emailHtml("You're now an instructor", "Welcome to the learning portal",
      mailer.paragraph(`Hello <strong>${mailer.esc(name)}</strong>,`) +
      mailer.statusBox("You have been added as an instructor on the learning portal.", "success") +
      mailer.muted("Your administrator can give you a login if you need to sign in."));
    const m = await sendMail(email, "You have been added as an instructor", html);
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

/* Give an instructor a login account: creates an invited user (role
   'instructor') linked to the instructor profile and emails a set-password link. */
app.post("/api/admin/instructors/:id/invite-login", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [[ins]] = await q("SELECT * FROM instructors WHERE id=?", [id]);
  if (!ins) return res.status(404).json({ error: "Instructor not found." });
  if (ins.user_id) {
    const [[existing]] = await q("SELECT id FROM users WHERE id=?", [ins.user_id]);
    if (existing) return res.status(409).json({ error: "This instructor already has a login account." });
  }
  const email = String(ins.email || "").trim().toLowerCase();
  if (!email.includes("@")) return res.status(400).json({ error: "Add a valid email to the instructor before inviting them to log in." });
  let username = String(req.body?.username || "").trim().toLowerCase();
  if (!username) username = String(ins.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || ("instr" + id);
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(email)=? OR lower(username)=? LIMIT 1", [email, username]);
  if (clash) return res.status(409).json({ error: "That email or username is already in use by another account." });

  const token = crypto.randomBytes(24).toString("hex");
  const parts = String(ins.name || "").trim().split(/\s+/);
  const first = parts.shift() || "";
  const last = parts.join(" ");
  const [r] = await q(
    "INSERT INTO users (name,first_name,last_name,phone,username,email,password_hash,role,status,reg_token) VALUES (?,?,?,?,?,?, '', 'instructor','invited', ?)",
    [ins.name || username, first, last, ins.phone || "", username, email, token]);
  await dbmod.linkInstructorUser(id, r.insertId);

  const link = `${req.protocol}://${req.get("host")}/register?token=${token}`;
  const html = await emailHtml("Set up your instructor login", "Access the learning portal as an instructor",
    mailer.paragraph(`Hello <strong>${mailer.esc(ins.name || "")}</strong>,`) +
    mailer.statusBox("You can now sign in to the learning portal as an instructor. Set your password to get started.", "info") +
    mailer.button("Set your password", link) +
    mailer.muted("If the button does not work, copy and paste this link:") + mailer.linkBox(link));
  const mail = await sendMail(email, "Set up your instructor login", html);
  res.json({
    ok: true, sent: mail.sent, link,
    msg: mail.sent ? `Login invitation sent to ${email}.` : `Login created, but email was not sent (${mail.reason}). Share this link:`,
    ...(await adminState()),
  });
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
    const html = await emailHtml("Your certificate is ready", "Congratulations on completing your course",
      mailer.paragraph(`Hello <strong>${mailer.esc(dbmod.displayName(stu))}</strong>,`) +
      mailer.statusBox(`Your certificate for ${mailer.esc(course.title)} has been issued.`, "success") +
      mailer.infoTable([["Course", mailer.esc(course.title)], ["Code", mailer.esc(course.code)], ["Certificate No", mailer.esc(certNo)]]) +
      mailer.muted("Sign in to your dashboard to download your certificate."));
    await sendMail(stu.email, "Your certificate has been issued", html);
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
  const html = await emailHtml("Your certificate", `Certificate for ${cert.courseTitle}`,
    mailer.paragraph(`Hello <strong>${mailer.esc(cert.studentName)}</strong>,`) +
    mailer.statusBox(`Your certificate for ${mailer.esc(cert.courseTitle)} is attached to this email.`, "success") +
    mailer.infoTable([["Course", mailer.esc(cert.courseTitle)], ["Code", mailer.esc(cert.courseCode)], ["Certificate No", mailer.esc(cert.cert_no)]]));
  const mail = await sendMail(cert.studentEmail, `Your certificate: ${cert.courseTitle}`, html,
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

/* ---- content groups (Moodle-style sections) ---- */
app.post("/api/admin/courses/:id/groups", auth, adminOnly, wrap(async (req, res) => {
  const id = req.params.id;
  const [[c]] = await q("SELECT id FROM courses WHERE id=?", [id]);
  if (!c) return res.status(404).json({ error: "Course not found." });
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Enter a group title." });
  await dbmod.addGroup(id, title);
  res.json(await adminState());
}));

app.put("/api/admin/courses/:id/groups/:gid", auth, adminOnly, wrap(async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Enter a group title." });
  await dbmod.renameGroup(req.params.id, Number(req.params.gid), title);
  res.json(await adminState());
}));

app.delete("/api/admin/courses/:id/groups/:gid", auth, adminOnly, wrap(async (req, res) => {
  await removeFiles(await dbmod.courseMaterialFiles(req.params.id, Number(req.params.gid)));
  await dbmod.deleteGroup(req.params.id, Number(req.params.gid));
  res.json(await adminState());
}));

app.post("/api/admin/courses/:id/groups/reorder", auth, adminOnly, wrap(async (req, res) => {
  if (!Array.isArray(req.body?.orderedIds)) return res.status(400).json({ error: "Invalid reorder." });
  await dbmod.reorderGroups(req.params.id, req.body.orderedIds.map(Number));
  res.json(await adminState());
}));

/* Delete the given stored files (relative to STORAGE), ignoring missing ones. */
async function removeFiles(relPaths) {
  for (const rel of relPaths || []) {
    if (!rel) continue;
    try { await fs.promises.unlink(path.join(STORAGE, rel)); } catch { /* already gone */ }
  }
}

const BUCKET = { recordings: "recordings", links: "links", materials: "materials" };
app.post("/api/admin/items", auth, adminOnly, wrap(async (req, res) => {
  const { courseId, groupId, bucket, title, url } = req.body || {};
  const t = String(title || "").trim();
  if (!BUCKET[bucket] || !t) return res.status(400).json({ error: "Enter a title." });
  if (!(await dbmod.groupExists(courseId, Number(groupId)))) return res.status(400).json({ error: "Pick a group first." });
  await dbmod.addCourseItem(courseId, Number(groupId), bucket, t, String(url || "").trim());
  res.json(await adminState());
}));

/* Upload a real file as a material (stored under storage/<course-code>/). */
app.post("/api/admin/items/upload", auth, adminOnly, uploadMaterial.single("file"), wrap(async (req, res) => {
  const courseId = String(req.query.courseId || "");
  const groupId = Number(req.query.groupId || 0);
  if (!req.file) return res.status(400).json({ error: "No file was uploaded." });
  if (!(await dbmod.groupExists(courseId, groupId))) {
    await removeFiles([path.relative(STORAGE, req.file.path)]);
    return res.status(400).json({ error: "Pick a group first." });
  }
  const rel = path.relative(STORAGE, req.file.path).split(path.sep).join("/");
  const ext = (path.extname(req.file.originalname).slice(1) || "FILE").toUpperCase().slice(0, 8);
  await dbmod.addMaterialFile(courseId, groupId, {
    title: req.file.originalname, size: humanSize(req.file.size), ext, filename: rel,
  });
  res.json(await adminState());
}));

app.delete("/api/admin/items", auth, adminOnly, wrap(async (req, res) => {
  const { courseId, bucket, itemId } = req.body || {};
  if (!BUCKET[bucket]) return res.status(400).json({ error: "Invalid bucket." });
  if (bucket === "materials") {
    const m = await dbmod.getMaterial(Number(itemId));
    if (m && m.filename) await removeFiles([m.filename]);
  }
  await dbmod.removeCourseItem(courseId, bucket, itemId);
  res.json(await adminState());
}));

/* Download a material file (admins, the assigned instructor, enrolled students). */
app.get("/api/materials/:id/file", auth, wrap(async (req, res) => {
  const m = await dbmod.getMaterial(Number(req.params.id));
  if (!m || !m.filename) return res.status(404).json({ error: "File not found." });
  if (!(await userCanAccessCourse(req.user, m.course_id))) return res.status(403).json({ error: "Not allowed." });
  const abs = path.join(STORAGE, m.filename);
  if (!abs.startsWith(STORAGE) || !fs.existsSync(abs)) return res.status(404).json({ error: "File not found." });
  res.download(abs, m.title || path.basename(abs));
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

/* ---- two-factor authentication (any signed-in user) ---- */
app.post("/api/account/2fa/setup", auth, wrap(async (req, res) => {
  const secret = totp.generateSecret();
  await q("UPDATE users SET totp_secret=?, totp_enabled=0 WHERE id=?", [secret, req.user.id]);
  const uri = totp.keyUri(secret, req.user.email || req.user.username, BRAND_ISSUER);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  res.json({ secret, otpauthUrl: uri, qrDataUrl });
}));

app.post("/api/account/2fa/enable", auth, wrap(async (req, res) => {
  const [[u]] = await q("SELECT totp_secret FROM users WHERE id=?", [req.user.id]);
  if (!u.totp_secret) return res.status(400).json({ error: "Start the setup first." });
  if (!totp.verify(u.totp_secret, req.body?.code)) {
    return res.status(400).json({ error: "That code is not valid. Check your device clock and try again." });
  }
  await q("UPDATE users SET totp_enabled=1 WHERE id=?", [req.user.id]);
  res.json({ ok: true });
}));

app.post("/api/account/2fa/disable", auth, wrap(async (req, res) => {
  const [[u]] = await q("SELECT totp_secret, totp_enabled FROM users WHERE id=?", [req.user.id]);
  if (u.totp_enabled && !totp.verify(u.totp_secret, req.body?.code)) {
    return res.status(400).json({ error: "Enter a valid code to turn off two-factor authentication." });
  }
  await q("UPDATE users SET totp_secret=NULL, totp_enabled=0 WHERE id=?", [req.user.id]);
  res.json({ ok: true });
}));

/* ---- administrator users (admins manage each other) ---- */
app.get("/api/admin/admins", auth, adminOnly, wrap(async (_req, res) => res.json({ admins: await dbmod.adminsList() })));

app.post("/api/admin/admins", auth, adminOnly, wrap(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim().toLowerCase();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!name) return res.status(400).json({ error: "Enter a full name." });
  if (!username) return res.status(400).json({ error: "Enter a username." });
  if (!email.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(username)=? OR lower(email)=? LIMIT 1", [username, email]);
  if (clash) return res.status(409).json({ error: "That username or email is already in use." });
  await dbmod.createAdmin({ name, username, email, password });
  res.json({ ok: true, admins: await dbmod.adminsList() });
}));

app.delete("/api/admin/admins/:id", auth, adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: "You cannot delete your own account." });
  if ((await dbmod.countAdmins()) <= 1) return res.status(400).json({ error: "At least one administrator must remain." });
  const [[u]] = await q("SELECT id FROM users WHERE id=? AND role='admin'", [id]);
  if (!u) return res.status(404).json({ error: "Administrator not found." });
  await dbmod.deleteAdminUser(id);
  res.json({ ok: true, admins: await dbmod.adminsList() });
}));

/* ---- backup & restore (admins) ----
   The database is small, so it backs up/restores reliably through the app.
   Course files can be huge: the file backup/restore here works for modest
   libraries, but for large storage use FTP directly against the storage/ folder. */
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

app.get("/api/admin/backup/db", auth, adminOnly, wrap(async (_req, res) => {
  const sql = await dbmod.dumpDatabase();
  res.setHeader("Content-Type", "application/sql");
  res.setHeader("Content-Disposition", `attachment; filename="lms-database-${stamp()}.sql"`);
  res.send(sql);
}));

app.get("/api/admin/backup/files", auth, adminOnly, wrap(async (_req, res) => {
  const zip = new AdmZip();
  zip.addLocalFolder(STORAGE);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="lms-files-${stamp()}.zip"`);
  res.send(zip.toBuffer());
}));

app.get("/api/admin/backup/all", auth, adminOnly, wrap(async (_req, res) => {
  const zip = new AdmZip();
  zip.addFile("database.sql", Buffer.from(await dbmod.dumpDatabase(), "utf8"));
  zip.addLocalFolder(STORAGE, "storage");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="lms-backup-${stamp()}.zip"`);
  res.send(zip.toBuffer());
}));

function extractStorage(zip, prefix) {
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    if (prefix && !e.entryName.startsWith(prefix)) continue;
    const rel = prefix ? e.entryName.slice(prefix.length) : e.entryName;
    if (!rel || rel.includes("..")) continue;
    const abs = path.join(STORAGE, rel);
    if (!abs.startsWith(STORAGE)) continue;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, e.getData());
  }
}

app.post("/api/admin/restore/db", auth, adminOnly, uploadBackup.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a .sql backup file." });
  await dbmod.runScript(req.file.buffer.toString("utf8"));
  res.json({ ok: true, msg: "Database restored." });
}));

app.post("/api/admin/restore/files", auth, adminOnly, uploadBackup.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a .zip file backup." });
  extractStorage(new AdmZip(req.file.buffer), "");
  res.json({ ok: true, msg: "Files restored." });
}));

app.post("/api/admin/restore/all", auth, adminOnly, uploadBackup.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a full backup .zip file." });
  const zip = new AdmZip(req.file.buffer);
  const dbEntry = zip.getEntry("database.sql");
  if (!dbEntry) return res.status(400).json({ error: "This zip has no database.sql (is it a full backup?)." });
  await dbmod.runScript(dbEntry.getData().toString("utf8"));
  extractStorage(zip, "storage/");
  res.json({ ok: true, msg: "Database and files restored." });
}));

/* ---- hCaptcha settings (admins) ---- */
app.put("/api/admin/hcaptcha", auth, adminOnly, wrap(async (req, res) => {
  const b = req.body || {};
  res.json(await dbmod.setHcaptcha({
    enabled: !!b.enabled,
    siteKey: String(b.siteKey || ""),
    secretKey: b.secretKey === undefined ? "" : String(b.secretKey),
  }));
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

/* Send a test email (to the signed-in admin, or a given address) so the admin
   can confirm the saved SMTP settings actually deliver. */
app.post("/api/admin/smtp/test", auth, adminOnly, wrap(async (req, res) => {
  const to = String(req.body?.to || req.user.email || "").trim();
  if (!to || !to.includes("@")) return res.status(400).json({ error: "No valid destination email. Add an email to your account or enter one." });
  const html = await emailHtml("SMTP test email", "Checking your outgoing mail",
    mailer.paragraph(`Hello <strong>${mailer.esc(dbmod.displayName(req.user))}</strong>,`) +
    mailer.statusBox("This is a test message from your learning portal. If it reached your inbox, SMTP is configured correctly.", "success") +
    mailer.muted("You can safely ignore this email."));
  const mail = await sendMail(to, "SMTP test email", html);
  if (!mail.sent) return res.status(400).json({ error: mail.reason || "Could not send the test email." });
  res.json({ ok: true, to });
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

/* ---- student registration number format ---- */
app.get("/api/admin/regnum", auth, adminOnly, wrap(async (_req, res) => res.json(await dbmod.getRegConfigForClient())));
app.put("/api/admin/regnum", auth, adminOnly, wrap(async (req, res) => {
  res.json(await dbmod.setRegConfig({ prefix: req.body?.prefix, width: req.body?.width }));
}));

/* JSON error handler (catches multer / middleware errors before the SPA fallback). */
app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  const tooBig = err && err.code === "LIMIT_FILE_SIZE";
  res.status(tooBig ? 413 : 400).json({ error: tooBig ? "That file is too large." : (err.message || "Request failed") });
});

/* ---- static build + SPA fallback ---- */
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = process.env.PORT || 3000;
dbmod.init()
  .then(() => app.listen(port, () => console.log("Learning Portal listening on port " + port)))
  .catch((e) => { console.error("Database init failed:", e.message); process.exit(1); });
