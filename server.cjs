/* Production server for cPanel (Passenger).
   Serves the JSON API + the prebuilt frontend in ./dist, with an SPA
   fallback so client-side routes work on refresh / deep links.
   Data lives in MySQL (see db.cjs); credentials come from env vars. */
require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const dbmod = require("./db.cjs");
const { q } = dbmod;

const app = express();
app.use(express.json({ limit: "6mb" })); // logo data URLs can be large

const dist = path.join(__dirname, "dist");

/* small async wrapper so thrown errors become 500s instead of hanging.
   Passes next through so it works for middleware (auth) and handlers alike. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => {
  console.error(e);
  if (!res.headersSent) res.status(500).json({ error: "Server error" });
});

async function publicUser(u) {
  return {
    name: dbmod.displayName(u),
    firstName: u.first_name || "", lastName: u.last_name || "", nickname: u.nickname || "",
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
  return { courses: await dbmod.coursesMap(), users: await dbmod.usersMap() };
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

/* ---- bootstrap ---- */
app.get("/api/bootstrap", auth, wrap(async (req, res) => {
  const u = req.user;
  if (u.role === "admin") {
    res.json({ currentUser: await publicUser(u), courses: await dbmod.coursesMap(), users: await dbmod.usersMap(), brand: await dbmod.getBrand(), smtp: await dbmod.getSmtpForClient() });
  } else {
    const ids = await dbmod.enrolledIds(u.id);
    res.json({ currentUser: await publicUser(u), courses: await dbmod.coursesMap(ids), locked: await dbmod.lockedCourses(ids), brand: await dbmod.getBrand() });
  }
}));

/* ---- admin: students ---- */
app.post("/api/admin/students", auth, adminOnly, wrap(async (req, res) => {
  const { name, email, username, password } = req.body || {};
  const nm = String(name || "").trim();
  const e = String(email || "").trim().toLowerCase();
  const un = String(username || "").trim().toLowerCase();
  if (!nm || !e.includes("@")) return res.status(400).json({ error: "Enter a name and a valid email." });
  if (!un || !password) return res.status(400).json({ error: "Enter a username and a password." });
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(email)=? OR lower(username)=? LIMIT 1", [e, un]);
  if (clash) return res.status(409).json({ error: "That email or username is already taken." });
  const parts = nm.split(/\s+/);
  const first = parts.shift() || ""; const last = parts.join(" ");
  await q("INSERT INTO users (name,first_name,last_name,nickname,username,email,password_hash,role,status) VALUES (?,?,?, '', ?,?,?, 'student','active')",
    [nm, first, last, un, e, bcrypt.hashSync(String(password), 10)]);
  res.json({ ok: true, msg: `Student ${nm} added. They can sign in now.`, ...(await adminState()) });
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

const BUCKET = { recordings: "recordings", links: "links", materials: "materials" };
app.post("/api/admin/items", auth, adminOnly, wrap(async (req, res) => {
  const { courseId, bucket, value } = req.body || {};
  const v = String(value || "").trim();
  if (!BUCKET[bucket] || !v) return res.status(400).json({ error: "Invalid item." });
  if (bucket === "recordings") await q("INSERT INTO recordings (course_id,title,date,length) VALUES (?,?, 'n/a','n/a')", [courseId, v]);
  else if (bucket === "links") await q("INSERT INTO links (course_id,title,url) VALUES (?,?, '#')", [courseId, v]);
  else await q("INSERT INTO materials (course_id,title,size,ext) VALUES (?,?, 'n/a','PDF')", [courseId, v]);
  res.json(await adminState());
}));

app.delete("/api/admin/items", auth, adminOnly, wrap(async (req, res) => {
  const { courseId, bucket, itemId } = req.body || {};
  if (!BUCKET[bucket]) return res.status(400).json({ error: "Invalid bucket." });
  await q(`DELETE FROM ${BUCKET[bucket]} WHERE id=? AND course_id=?`, [itemId, courseId]);
  res.json(await adminState());
}));

/* ---- account self-service (any signed-in user; username cannot change) ---- */
app.put("/api/account", auth, wrap(async (req, res) => {
  const { firstName, lastName, nickname, email } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  if (!e.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(email)=? AND id<>?", [e, req.user.id]);
  if (clash) return res.status(409).json({ error: "That email is already in use." });
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  const nick = String(nickname || "").trim();
  const name = nick || [first, last].filter(Boolean).join(" ") || req.user.username;
  await q("UPDATE users SET first_name=?, last_name=?, nickname=?, email=?, name=? WHERE id=?", [first, last, nick, e, name, req.user.id]);
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
