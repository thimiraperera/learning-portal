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
const { q } = dbmod;

const app = express();
app.set("trust proxy", true); // so req.protocol reflects the proxy (https)
app.use(express.json({ limit: "6mb" })); // logo data URLs can be large

const dist = path.join(__dirname, "dist");

/* Send mail via the stored SMTP settings. Returns {sent, reason}. */
async function sendMail(to, subject, html) {
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
    await transporter.sendMail({ from, to, subject, html });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
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
  return { courses: await dbmod.coursesMap(), users: await dbmod.usersMap(), instructors: await dbmod.instructorsList() };
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
    res.json({ currentUser: await publicUser(u), courses: await dbmod.coursesMap(), users: await dbmod.usersMap(), instructors: await dbmod.instructorsList(), brand: await dbmod.getBrand(), smtp: await dbmod.getSmtpForClient() });
  } else {
    const ids = await dbmod.enrolledIds(u.id);
    res.json({ currentUser: await publicUser(u), courses: await dbmod.coursesMap(ids), locked: await dbmod.lockedCourses(ids), brand: await dbmod.getBrand() });
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
  await dbmod.updateCourse(id, {
    code, title,
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
  await dbmod.addInstructor({
    name, email: String(req.body?.email || ""), phone: String(req.body?.phone || ""),
    title: String(req.body?.title || ""), bio: String(req.body?.bio || ""),
    gender: String(req.body?.gender || ""), notes: String(req.body?.notes || ""),
  });
  res.json(await adminState());
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
