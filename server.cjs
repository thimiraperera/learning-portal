/* Production server for cPanel (Passenger).
   Serves the JSON API + the Vite build in ./dist, with an SPA fallback so
   client-side routes work on refresh / deep links. */
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const dbmod = require("./db.cjs");
const { db } = dbmod;

const app = express();
app.use(express.json({ limit: "6mb" })); // logo data URLs can be large

const dist = path.join(__dirname, "dist");

/* ---- auth (bearer tokens persisted in the DB so they survive restarts) ---- */
function publicUser(u) {
  return {
    name: dbmod.displayName(u),
    firstName: u.first_name || "", lastName: u.last_name || "", nickname: u.nickname || "",
    email: u.email, username: u.username, role: u.role, status: u.status,
    enrolled: dbmod.enrolledIds(u.id),
  };
}
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  const sess = t && db.prepare("SELECT user_id FROM sessions WHERE token=?").get(t);
  const u = sess && db.prepare("SELECT * FROM users WHERE id=?").get(sess.user_id);
  if (!u) return res.status(401).json({ error: "Not authenticated" });
  req.user = u; req.token = t; next();
}
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  next();
}
function adminState() {
  return { courses: dbmod.coursesMap(), users: dbmod.usersMap() };
}

/* ---- public ---- */
app.get("/api/brand", (_req, res) => res.json(dbmod.getBrand()));

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password are required." });
  const u = db.prepare("SELECT * FROM users WHERE lower(username)=lower(?)").get(String(username).trim());
  if (!u || !bcrypt.compareSync(String(password), u.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)").run(token, u.id, Date.now());
  res.json({ token, user: publicUser(u) });
});

app.post("/api/logout", auth, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token=?").run(req.token);
  res.json({ ok: true });
});

/* ---- bootstrap: everything the logged-in user needs ---- */
app.get("/api/bootstrap", auth, (req, res) => {
  const u = req.user;
  if (u.role === "admin") {
    res.json({ currentUser: publicUser(u), courses: dbmod.coursesMap(), users: dbmod.usersMap(), brand: dbmod.getBrand(), smtp: dbmod.getSmtpForClient() });
  } else {
    const ids = dbmod.enrolledIds(u.id);
    res.json({ currentUser: publicUser(u), courses: dbmod.coursesMap(ids), locked: dbmod.lockedCourses(ids), brand: dbmod.getBrand() });
  }
});

/* ---- admin: students ---- */
app.post("/api/admin/students", auth, adminOnly, (req, res) => {
  const { name, email, username, password } = req.body || {};
  const nm = String(name || "").trim();
  const e = String(email || "").trim().toLowerCase();
  const un = String(username || "").trim().toLowerCase();
  if (!nm || !e.includes("@")) return res.status(400).json({ error: "Enter a name and a valid email." });
  if (!un || !password) return res.status(400).json({ error: "Enter a username and a password." });
  const clash = db.prepare("SELECT 1 FROM users WHERE lower(email)=? OR lower(username)=?").get(e, un);
  if (clash) return res.status(409).json({ error: "That email or username is already taken." });
  db.prepare("INSERT INTO users (name,username,email,password_hash,role,status) VALUES (?,?,?,?, 'student','active')")
    .run(nm, un, e, bcrypt.hashSync(String(password), 10));
  res.json({ ok: true, msg: `Student ${nm} added. They can sign in now.`, ...adminState() });
});

app.delete("/api/admin/students", auth, adminOnly, (req, res) => {
  const e = String(req.body?.email || "").trim().toLowerCase();
  const u = db.prepare("SELECT id FROM users WHERE lower(email)=? AND role='student'").get(e);
  if (u) {
    db.prepare("DELETE FROM enrolments WHERE user_id=?").run(u.id);
    db.prepare("DELETE FROM users WHERE id=?").run(u.id);
  }
  res.json(adminState());
});

/* ---- admin: enrolment toggle ---- */
app.post("/api/admin/enrol", auth, adminOnly, (req, res) => {
  const e = String(req.body?.email || "").trim().toLowerCase();
  const cid = String(req.body?.courseId || "");
  const u = db.prepare("SELECT id FROM users WHERE lower(email)=?").get(e);
  if (u && db.prepare("SELECT 1 FROM courses WHERE id=?").get(cid)) {
    const has = db.prepare("SELECT 1 FROM enrolments WHERE user_id=? AND course_id=?").get(u.id, cid);
    if (has) db.prepare("DELETE FROM enrolments WHERE user_id=? AND course_id=?").run(u.id, cid);
    else db.prepare("INSERT INTO enrolments (user_id,course_id) VALUES (?,?)").run(u.id, cid);
  }
  res.json(adminState());
});

/* ---- admin: courses & items ---- */
app.post("/api/admin/courses", auth, adminOnly, (req, res) => {
  const title = String(req.body?.title || "").trim();
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!title || !code) return res.status(400).json({ error: "Enter a title and a code." });
  const id = "c" + Date.now().toString(36);
  db.prepare("INSERT INTO courses (id,code,title,instructor,blurb,sessions) VALUES (?,?,?,?,?,0)")
    .run(id, code, title, "", "Newly created course.");
  res.json(adminState());
});

const BUCKET = { recordings: "recordings", links: "links", materials: "materials" };
app.post("/api/admin/items", auth, adminOnly, (req, res) => {
  const { courseId, bucket, value } = req.body || {};
  const v = String(value || "").trim();
  if (!BUCKET[bucket] || !v) return res.status(400).json({ error: "Invalid item." });
  if (bucket === "recordings") db.prepare("INSERT INTO recordings (course_id,title,date,length) VALUES (?,?, 'n/a','n/a')").run(courseId, v);
  else if (bucket === "links") db.prepare("INSERT INTO links (course_id,title,url) VALUES (?,?, '#')").run(courseId, v);
  else db.prepare("INSERT INTO materials (course_id,title,size,ext) VALUES (?,?, 'n/a','PDF')").run(courseId, v);
  res.json(adminState());
});

app.delete("/api/admin/items", auth, adminOnly, (req, res) => {
  const { courseId, bucket, itemId } = req.body || {};
  if (!BUCKET[bucket]) return res.status(400).json({ error: "Invalid bucket." });
  db.prepare(`DELETE FROM ${BUCKET[bucket]} WHERE id=? AND course_id=?`).run(itemId, courseId);
  res.json(adminState());
});

/* ---- account self-service (any signed-in user; username cannot change) ---- */
app.put("/api/account", auth, (req, res) => {
  const { firstName, lastName, nickname, email } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  if (!e.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
  const clash = db.prepare("SELECT 1 FROM users WHERE lower(email)=? AND id<>?").get(e, req.user.id);
  if (clash) return res.status(409).json({ error: "That email is already in use." });
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  const nick = String(nickname || "").trim();
  const name = nick || [first, last].filter(Boolean).join(" ") || req.user.username;
  db.prepare("UPDATE users SET first_name=?, last_name=?, nickname=?, email=?, name=? WHERE id=?")
    .run(first, last, nick, e, name, req.user.id);
  res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id)) });
});

app.post("/api/account/password", auth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!bcrypt.compareSync(String(currentPassword || ""), req.user.password_hash)) {
    return res.status(400).json({ error: "Your current password is incorrect." });
  }
  if (String(newPassword || "").length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(String(newPassword), 10), req.user.id);
  res.json({ ok: true });
});

/* ---- SMTP settings (admins) ---- */
app.put("/api/admin/smtp", auth, adminOnly, (req, res) => {
  const b = req.body || {};
  res.json(dbmod.setSmtp({
    host: String(b.host || ""), port: String(b.port || ""),
    username: String(b.username || ""), password: b.password === undefined ? "" : String(b.password),
    fromEmail: String(b.fromEmail || ""), fromName: String(b.fromName || ""),
    useTls: !!b.useTls, useSsl: !!b.useSsl,
  }));
});

/* ---- branding (stored in the DB, shared across devices) ---- */
app.put("/api/brand", auth, adminOnly, (req, res) => {
  const brand = {
    company: String(req.body?.company || ""),
    name: String(req.body?.name || ""),
    logo: String(req.body?.logo || ""),
  };
  db.prepare("INSERT INTO settings (key,value) VALUES ('brand',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(JSON.stringify(brand));
  res.json(brand);
});

/* ---- static build + SPA fallback ---- */
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Learning Portal listening on port " + port));
