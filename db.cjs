/* MySQL data layer for the Learning Portal.
   Credentials come from environment variables (set in the cPanel Node.js App
   UI, or a local .env file). Nothing secret is committed to the repo.
   On first run it creates the schema, migrates older databases, and seeds
   demo data with hashed passwords. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  charset: "utf8mb4",
});

const q = (sql, params) => pool.query(sql, params);

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     first_name VARCHAR(255) DEFAULT '',
     last_name VARCHAR(255) DEFAULT '',
     nickname VARCHAR(255) DEFAULT '',
     phone VARCHAR(60) DEFAULT '',
     gender VARCHAR(20) DEFAULT '',
     notes TEXT,
     username VARCHAR(190) NOT NULL UNIQUE,
     email VARCHAR(190) NOT NULL UNIQUE,
     password_hash VARCHAR(255) NOT NULL,
     role VARCHAR(20) NOT NULL DEFAULT 'student',
     status VARCHAR(20) NOT NULL DEFAULT 'active',
     reg_token VARCHAR(64)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS courses (
     id VARCHAR(32) PRIMARY KEY, code VARCHAR(40) NOT NULL, title VARCHAR(255) NOT NULL,
     instructor VARCHAR(255), instructor_id INT, blurb TEXT, sessions INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS instructors (
     id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL,
     email VARCHAR(190), phone VARCHAR(60), title VARCHAR(190), bio TEXT,
     gender VARCHAR(20) DEFAULT '', notes TEXT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS course_instructors (
     course_id VARCHAR(32) NOT NULL, instructor_id INT NOT NULL,
     PRIMARY KEY (course_id, instructor_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS recordings (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, title VARCHAR(255) NOT NULL, date VARCHAR(64), length VARCHAR(64)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS links (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, title VARCHAR(255) NOT NULL, url TEXT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS materials (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, title VARCHAR(255) NOT NULL, size VARCHAR(40), ext VARCHAR(16)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS enrolments (
     user_id INT NOT NULL, course_id VARCHAR(32) NOT NULL, PRIMARY KEY (user_id, course_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS settings (
     k VARCHAR(64) PRIMARY KEY, v LONGTEXT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token VARCHAR(64) PRIMARY KEY, user_id INT NOT NULL, created_at BIGINT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function ensureColumn(table, col, decl) {
  const [rows] = await q(
    "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?",
    [table, col]
  );
  if (rows[0].n === 0) await q(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
}

function displayName(u) {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return (u.nickname && u.nickname.trim()) || full || u.username;
}

async function seedIfEmpty() {
  const [[{ n }]] = await q("SELECT COUNT(*) AS n FROM users");
  if (n > 0) return;

  const mk = async (first, last, username, email, pw, role) => {
    const [r] = await q(
      "INSERT INTO users (name,first_name,last_name,nickname,username,email,password_hash,role,status) VALUES (?,?,?,?,?,?,?,?, 'active')",
      [`${first} ${last}`.trim(), first, last, "", username, email, bcrypt.hashSync(pw, 10), role]
    );
    return r.insertId;
  };
  await mk("Chamira", "H.", "admin", "chamira@demo.lk", "admin123", "admin");
  const ravi  = await mk("Ravi", "Perera", "ravi", "ravi@demo.lk", "ravi123", "student");
  const amara = await mk("Amara", "Silva", "amara", "amara@demo.lk", "amara123", "student");
  await mk("Dilan", "Fernando", "dilan", "dilan@demo.lk", "dilan123", "student");

  const [insRes] = await q("INSERT INTO instructors (name,email,phone,title,bio) VALUES (?,?,?,?,?)",
    ["C. Hettiarachchi", "chamira@demo.lk", "", "Lead Mentor", "Founder and lead mentor of the programme."]);
  const instrId = insRes.insertId;

  const course = (id, code, title, blurb, sessions) =>
    q("INSERT INTO courses (id,code,title,instructor,instructor_id,blurb,sessions) VALUES (?,?,?,?,?,?,?)", [id, code, title, "C. Hettiarachchi", instrId, blurb, sessions]);
  const rec = (cid, t, d, len) => q("INSERT INTO recordings (course_id,title,date,length) VALUES (?,?,?,?)", [cid, t, d, len]);
  const link = (cid, t, u) => q("INSERT INTO links (course_id,title,url) VALUES (?,?,?)", [cid, t, u]);
  const mat = (cid, t, size, ext) => q("INSERT INTO materials (course_id,title,size,ext) VALUES (?,?,?,?)", [cid, t, size, ext]);

  await course("c1", "EQ-101", "Foundations of Equity Markets", "How exchanges, orders and price discovery actually work.", 8);
  await rec("c1", "Market structure & order types", "May 04, 2026", "1h 12m");
  await rec("c1", "Reading a quote: bid, ask, spread", "May 11, 2026", "58m");
  await rec("c1", "Primary vs secondary markets", "May 18, 2026", "1h 04m");
  await rec("c1", "Settlement, custody & the CDS", "May 25, 2026", "47m");
  await link("c1", "Colombo Stock Exchange (live board)", "https://www.cse.lk");
  await link("c1", "Glossary: 40 terms every beginner needs", "#");
  await mat("c1", "Session 1-2 slide deck", "4.2 MB", "PDF");
  await mat("c1", "Order-types cheat sheet", "180 KB", "PDF");

  await course("c2", "TA-220", "Technical Analysis Masterclass", "Price action, structure and the discipline behind the charts.", 10);
  await rec("c2", "Support, resistance & market memory", "May 06, 2026", "1h 21m");
  await rec("c2", "Trend, range and the in-between", "May 13, 2026", "1h 09m");
  await rec("c2", "Volume as confirmation", "May 20, 2026", "55m");
  await link("c2", "Charting workspace template", "#");
  await link("c2", "Pattern reference library", "#");
  await mat("c2", "TA pattern handbook", "9.8 MB", "PDF");
  await mat("c2", "Trade journal template", "320 KB", "XLSX");

  await course("c3", "DV-310", "Options & Derivatives", "Payoffs, greeks and structuring positions with intent.", 9);
  await rec("c3", "Calls, puts & the payoff diagram", "May 09, 2026", "1h 30m");
  await rec("c3", "The greeks, plainly", "May 16, 2026", "1h 18m");
  await link("c3", "Options payoff simulator", "#");
  await mat("c3", "Greeks quick-reference", "640 KB", "PDF");

  await course("c4", "PF-330", "Portfolio Construction & Risk", "Sizing, diversification and surviving your worst week.", 7);
  await rec("c4", "Position sizing & the 2% rule", "May 12, 2026", "1h 02m");
  await link("c4", "Risk calculator spreadsheet", "#");
  await mat("c4", "Allocation worksheet", "210 KB", "XLSX");

  await q("INSERT INTO enrolments (user_id,course_id) VALUES (?,?),(?,?),(?,?),(?,?),(?,?)",
    [ravi, "c1", ravi, "c2", amara, "c2", amara, "c3", amara, "c4"]);

  await q("INSERT INTO settings (k,v) VALUES ('brand',?)", [JSON.stringify({ company: "", name: "Learning Portal", logo: "" })]);
}

async function init() {
  for (const sql of TABLES) await q(sql);
  for (const col of ["first_name", "last_name", "nickname"]) await ensureColumn("users", col, "VARCHAR(255) DEFAULT ''");
  await ensureColumn("users", "phone", "VARCHAR(60) DEFAULT ''");
  await ensureColumn("users", "reg_token", "VARCHAR(64)");
  await ensureColumn("users", "gender", "VARCHAR(20) DEFAULT ''");
  await ensureColumn("users", "notes", "TEXT");
  await ensureColumn("instructors", "gender", "VARCHAR(20) DEFAULT ''");
  await ensureColumn("instructors", "notes", "TEXT");
  await ensureColumn("courses", "instructor_id", "INT");
  const [needs] = await q("SELECT id, name FROM users WHERE COALESCE(first_name,'')='' AND COALESCE(last_name,'')=''");
  for (const u of needs) {
    const parts = String(u.name || "").trim().split(/\s+/);
    await q("UPDATE users SET first_name=?, last_name=? WHERE id=?", [parts.shift() || "", parts.join(" "), u.id]);
  }
  await seedIfEmpty();
  // Migrate any free-text course instructors into the instructors table.
  const [[{ ni }]] = await q("SELECT COUNT(*) AS ni FROM instructors");
  if (ni === 0) {
    const [names] = await q("SELECT DISTINCT instructor FROM courses WHERE instructor IS NOT NULL AND instructor<>''");
    for (const row of names) {
      const [r] = await q("INSERT INTO instructors (name) VALUES (?)", [row.instructor]);
      await q("UPDATE courses SET instructor_id=? WHERE instructor=?", [r.insertId, row.instructor]);
    }
  }
  // Migrate the single instructor_id link into the many-to-many join table.
  const [[{ nci }]] = await q("SELECT COUNT(*) AS nci FROM course_instructors");
  if (nci === 0) {
    const [linked] = await q("SELECT id, instructor_id FROM courses WHERE instructor_id IS NOT NULL");
    for (const row of linked) await q("INSERT IGNORE INTO course_instructors (course_id,instructor_id) VALUES (?,?)", [row.id, row.instructor_id]);
  }
}

/* ---- read helpers (assemble the shapes the frontend expects) ---- */
async function courseFull(id) {
  const [[c]] = await q("SELECT * FROM courses WHERE id=?", [id]);
  if (!c) return null;
  const [instructors] = await q(
    "SELECT i.id, i.name, i.title FROM course_instructors ci JOIN instructors i ON i.id=ci.instructor_id WHERE ci.course_id=? ORDER BY i.name", [id]);
  const [recordings] = await q("SELECT id, title AS t, date AS d, length AS len FROM recordings WHERE course_id=? ORDER BY id", [id]);
  const [links] = await q("SELECT id, title AS t, url AS u FROM links WHERE course_id=? ORDER BY id", [id]);
  const [materials] = await q("SELECT id, title AS t, size, ext FROM materials WHERE course_id=? ORDER BY id", [id]);
  return {
    code: c.code, title: c.title, blurb: c.blurb, sessions: c.sessions,
    instructors, instructor: instructors.map((x) => x.name).join(", "),
    recordings, links, materials,
  };
}
async function coursesMap(ids) {
  const [rows] = await q("SELECT id FROM courses ORDER BY id");
  const map = {};
  for (const { id } of rows) if (!ids || ids.includes(id)) map[id] = await courseFull(id);
  return map;
}
async function enrolledIds(userId) {
  const [rows] = await q("SELECT course_id FROM enrolments WHERE user_id=?", [userId]);
  return rows.map((r) => r.course_id);
}
async function lockedCourses(ids) {
  const [rows] = await q("SELECT id, title FROM courses ORDER BY id");
  return rows.filter((c) => !ids.includes(c.id));
}
async function usersMap() {
  const [rows] = await q("SELECT * FROM users WHERE role='student' ORDER BY id");
  const map = {};
  for (const u of rows) {
    map[u.email] = {
      id: u.id, name: displayName(u), username: u.username, email: u.email,
      firstName: u.first_name || "", lastName: u.last_name || "", nickname: u.nickname || "", phone: u.phone || "",
      gender: u.gender || "", notes: u.notes || "",
      role: u.role, status: u.status, enrolled: await enrolledIds(u.id),
    };
  }
  return map;
}
async function inviteStudent({ name, email, username, token }) {
  const parts = name.trim().split(/\s+/);
  const first = parts.shift() || "";
  const last = parts.join(" ");
  await q("INSERT INTO users (name,first_name,last_name,nickname,phone,username,email,password_hash,role,status,reg_token) VALUES (?,?,?, '','', ?,?, '', 'student','invited', ?)",
    [name.trim(), first, last, username, email, token]);
}
async function getInvite(token) {
  const [[u]] = await q("SELECT id, name, email, username FROM users WHERE reg_token=? AND status='invited'", [token]);
  return u || null;
}
async function completeRegistration(token, name, passwordHash) {
  const parts = name.trim().split(/\s+/);
  const first = parts.shift() || "";
  const last = parts.join(" ");
  const [r] = await q("UPDATE users SET name=?, first_name=?, last_name=?, password_hash=?, status='active', reg_token=NULL WHERE reg_token=? AND status='invited'",
    [name.trim(), first, last, passwordHash, token]);
  return r.affectedRows > 0;
}
async function updateStudentProfile(id, f) {
  const name = f.nickname || [f.firstName, f.lastName].filter(Boolean).join(" ") || "";
  await q("UPDATE users SET first_name=?, last_name=?, nickname=?, phone=?, gender=?, notes=?, email=?, name=? WHERE id=? AND role='student'",
    [f.firstName, f.lastName, f.nickname, f.phone, f.gender || "", f.notes || "", f.email, name || f.email, id]);
}
async function updateCourse(id, f) {
  await q("UPDATE courses SET code=?, title=?, blurb=?, sessions=? WHERE id=?",
    [f.code, f.title, f.blurb, f.sessions, id]);
}

async function instructorsList() {
  const [rows] = await q("SELECT id, name, email, phone, title, bio, gender, notes FROM instructors ORDER BY name");
  return rows;
}
async function addInstructor(f) {
  await q("INSERT INTO instructors (name,email,phone,title,bio,gender,notes) VALUES (?,?,?,?,?,?,?)",
    [f.name, f.email, f.phone, f.title, f.bio, f.gender || "", f.notes || ""]);
}
async function updateInstructor(id, f) {
  await q("UPDATE instructors SET name=?, email=?, phone=?, title=?, bio=?, gender=?, notes=? WHERE id=?",
    [f.name, f.email, f.phone, f.title, f.bio, f.gender || "", f.notes || "", id]);
}
async function deleteInstructor(id) {
  await q("DELETE FROM course_instructors WHERE instructor_id=?", [id]);
  await q("UPDATE courses SET instructor_id=NULL WHERE instructor_id=?", [id]);
  await q("DELETE FROM instructors WHERE id=?", [id]);
}
async function addCourseInstructor(courseId, instructorId) {
  await q("INSERT IGNORE INTO course_instructors (course_id,instructor_id) VALUES (?,?)", [courseId, Number(instructorId)]);
}
async function removeCourseInstructor(courseId, instructorId) {
  await q("DELETE FROM course_instructors WHERE course_id=? AND instructor_id=?", [courseId, Number(instructorId)]);
}
async function deleteCourse(id) {
  await q("DELETE FROM recordings WHERE course_id=?", [id]);
  await q("DELETE FROM links WHERE course_id=?", [id]);
  await q("DELETE FROM materials WHERE course_id=?", [id]);
  await q("DELETE FROM enrolments WHERE course_id=?", [id]);
  await q("DELETE FROM course_instructors WHERE course_id=?", [id]);
  await q("DELETE FROM courses WHERE id=?", [id]);
}
async function getBrand() {
  const [[row]] = await q("SELECT v FROM settings WHERE k='brand'");
  return row ? JSON.parse(row.v) : { company: "", name: "Learning Portal", logo: "" };
}
async function setBrandValue(brand) {
  await q("INSERT INTO settings (k,v) VALUES ('brand',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify(brand)]);
  return brand;
}

const SMTP_DEFAULT = { host: "", port: "587", username: "", password: "", fromEmail: "", fromName: "", useTls: true, useSsl: false };
async function getSmtp() {
  const [[row]] = await q("SELECT v FROM settings WHERE k='smtp'");
  return row ? { ...SMTP_DEFAULT, ...JSON.parse(row.v) } : { ...SMTP_DEFAULT };
}
async function getSmtpForClient() {
  const { password, ...rest } = await getSmtp();
  return { ...rest, hasPassword: !!password };
}
async function setSmtp(next) {
  const cur = await getSmtp();
  const merged = { ...cur, ...next };
  if (next.password === undefined || next.password === "") merged.password = cur.password;
  await q("INSERT INTO settings (k,v) VALUES ('smtp',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify(merged)]);
  return getSmtpForClient();
}

module.exports = {
  pool, q, init, displayName, courseFull, coursesMap, enrolledIds, lockedCourses, usersMap,
  updateCourse, deleteCourse, updateStudentProfile, inviteStudent, getInvite, completeRegistration,
  instructorsList, addInstructor, updateInstructor, deleteInstructor,
  addCourseInstructor, removeCourseInstructor,
  getBrand, setBrandValue, getSmtp, getSmtpForClient, setSmtp,
};
