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
     avatar LONGTEXT,
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
  `CREATE TABLE IF NOT EXISTS content_groups (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, title VARCHAR(255) NOT NULL, position INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS recordings (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, group_id INT DEFAULT 0, title VARCHAR(255) NOT NULL, date VARCHAR(64), length VARCHAR(64), position INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS links (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, group_id INT DEFAULT 0, title VARCHAR(255) NOT NULL, url TEXT, position INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS materials (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, group_id INT DEFAULT 0, title VARCHAR(255) NOT NULL, size VARCHAR(40), ext VARCHAR(16), filename VARCHAR(512), position INT DEFAULT 0
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
  `CREATE TABLE IF NOT EXISTS certificates (
     id INT AUTO_INCREMENT PRIMARY KEY, cert_no VARCHAR(40) NOT NULL UNIQUE,
     student_id INT NOT NULL, course_id VARCHAR(32) NOT NULL, issued_at BIGINT,
     downloaded TINYINT DEFAULT 0, unlocked TINYINT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS exams (
     id INT AUTO_INCREMENT PRIMARY KEY,
     course_id VARCHAR(32) DEFAULT '',
     title VARCHAR(255) NOT NULL,
     question_count INT DEFAULT 0,
     time_limit INT DEFAULT 0,
     created_at BIGINT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS exam_questions (
     id INT AUTO_INCREMENT PRIMARY KEY,
     exam_id INT NOT NULL,
     question TEXT NOT NULL,
     options TEXT NOT NULL,
     correct INT DEFAULT 0,
     qtype VARCHAR(10) DEFAULT 'single',
     corrects TEXT,
     position INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS exam_attempts (
     id INT AUTO_INCREMENT PRIMARY KEY,
     exam_id INT NOT NULL,
     user_id INT NOT NULL,
     started_at BIGINT,
     finished_at BIGINT,
     score DECIMAL(6,2) DEFAULT 0,
     total INT DEFAULT 0,
     snapshot LONGTEXT
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
  await ensureColumn("users", "avatar", "LONGTEXT");
  await ensureColumn("instructors", "gender", "VARCHAR(20) DEFAULT ''");
  await ensureColumn("instructors", "notes", "TEXT");
  await ensureColumn("recordings", "position", "INT DEFAULT 0");
  await ensureColumn("links", "position", "INT DEFAULT 0");
  await ensureColumn("materials", "position", "INT DEFAULT 0");
  await ensureColumn("recordings", "group_id", "INT DEFAULT 0");
  await ensureColumn("links", "group_id", "INT DEFAULT 0");
  await ensureColumn("materials", "group_id", "INT DEFAULT 0");
  await ensureColumn("materials", "filename", "VARCHAR(512)");
  await ensureColumn("courses", "instructor_id", "INT");
  await ensureColumn("courses", "cert_template", "VARCHAR(64) DEFAULT ''");
  await ensureColumn("exam_questions", "qtype", "VARCHAR(10) DEFAULT 'single'");
  await ensureColumn("exam_questions", "corrects", "TEXT");
  await ensureColumn("users", "totp_secret", "VARCHAR(64)");
  await ensureColumn("users", "totp_enabled", "TINYINT DEFAULT 0");
  await ensureColumn("instructors", "user_id", "INT");
  // Checkbox questions earn partial marks, so attempt scores can be fractional.
  await q("ALTER TABLE exam_attempts MODIFY score DECIMAL(6,2) DEFAULT 0");
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
  // Content groups (Moodle-style sections): make sure every existing item
  // belongs to a group, creating a "General" group per course as needed.
  const [ungrouped] = await q(`SELECT DISTINCT course_id FROM (
      SELECT course_id FROM recordings WHERE COALESCE(group_id,0)=0
      UNION SELECT course_id FROM links WHERE COALESCE(group_id,0)=0
      UNION SELECT course_id FROM materials WHERE COALESCE(group_id,0)=0
    ) t`);
  for (const { course_id } of ungrouped) {
    const [[c]] = await q("SELECT id FROM courses WHERE id=?", [course_id]);
    if (!c) continue;
    let [[g]] = await q("SELECT id FROM content_groups WHERE course_id=? ORDER BY position, id LIMIT 1", [course_id]);
    if (!g) {
      const [r] = await q("INSERT INTO content_groups (course_id,title,position) VALUES (?, 'General', 0)", [course_id]);
      g = { id: r.insertId };
    }
    for (const t of ["recordings", "links", "materials"]) {
      await q(`UPDATE ${t} SET group_id=? WHERE course_id=? AND COALESCE(group_id,0)=0`, [g.id, course_id]);
    }
  }
}

/* ---- read helpers (assemble the shapes the frontend expects) ---- */
async function courseFull(id) {
  const [[c]] = await q("SELECT * FROM courses WHERE id=?", [id]);
  if (!c) return null;
  const [instructors] = await q(
    "SELECT i.id, i.name, i.title FROM course_instructors ci JOIN instructors i ON i.id=ci.instructor_id WHERE ci.course_id=? ORDER BY i.name", [id]);
  const [recordings] = await q("SELECT id, group_id, title AS t, date AS d, length AS len FROM recordings WHERE course_id=? ORDER BY position, id", [id]);
  const [links] = await q("SELECT id, group_id, title AS t, url AS u FROM links WHERE course_id=? ORDER BY position, id", [id]);
  const [materials] = await q("SELECT id, group_id, title AS t, size, ext, filename FROM materials WHERE course_id=? ORDER BY position, id", [id]);
  const [groupRows] = await q("SELECT id, title FROM content_groups WHERE course_id=? ORDER BY position, id", [id]);
  const groups = groupRows.map((g) => ({
    id: g.id, title: g.title,
    recordings: recordings.filter((r) => r.group_id === g.id),
    links: links.filter((r) => r.group_id === g.id),
    materials: materials.filter((r) => r.group_id === g.id),
  }));
  return {
    code: c.code, title: c.title, blurb: c.blurb, sessions: c.sessions,
    certTemplate: c.cert_template || "",
    instructors, instructor: instructors.map((x) => x.name).join(", "),
    recordings, links, materials, groups,
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
      gender: u.gender || "", notes: u.notes || "", avatar: u.avatar || "",
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
async function completeRegistration(token, f, passwordHash) {
  const [r] = await q(
    "UPDATE users SET name=?, first_name=?, last_name=?, phone=?, gender=?, password_hash=?, status='active', reg_token=NULL WHERE reg_token=? AND status='invited'",
    [f.name.trim(), f.firstName.trim(), f.lastName.trim(), f.phone || "", f.gender || "", passwordHash, token]);
  return r.affectedRows > 0;
}
async function updateStudentProfile(id, f) {
  const name = f.nickname || [f.firstName, f.lastName].filter(Boolean).join(" ") || "";
  await q("UPDATE users SET first_name=?, last_name=?, nickname=?, phone=?, gender=?, notes=?, email=?, name=? WHERE id=? AND role='student'",
    [f.firstName, f.lastName, f.nickname, f.phone, f.gender || "", f.notes || "", f.email, name || f.email, id]);
  // Admins can flip active/inactive, but never override the pre-registration "invited" state.
  if (f.status === "active" || f.status === "inactive") {
    await q("UPDATE users SET status=? WHERE id=? AND role='student' AND status<>'invited'", [f.status, id]);
  }
}
async function updateCourse(id, f) {
  await q("UPDATE courses SET code=?, title=?, blurb=?, sessions=?, cert_template=? WHERE id=?",
    [f.code, f.title, f.blurb, f.sessions, f.certTemplate || "", id]);
}

async function instructorsList() {
  const [rows] = await q(`SELECT i.id, i.name, i.email, i.phone, i.title, i.bio, i.gender, i.notes, i.user_id,
      u.username AS loginUsername, u.status AS loginStatus, u.totp_enabled AS twoFactor
    FROM instructors i LEFT JOIN users u ON u.id=i.user_id ORDER BY i.name`);
  return rows.map((r) => ({ ...r, twoFactor: !!r.twoFactor }));
}
async function instructorByUserId(userId) {
  const [[r]] = await q("SELECT * FROM instructors WHERE user_id=?", [userId]);
  return r || null;
}
/* Read-only course list for an instructor's portal. */
async function coursesForInstructor(instructorId) {
  const [rows] = await q(
    "SELECT ci.course_id FROM course_instructors ci WHERE ci.instructor_id=? ORDER BY ci.course_id", [instructorId]);
  const map = {};
  for (const { course_id } of rows) map[course_id] = await courseFull(course_id);
  return map;
}
async function linkInstructorUser(instructorId, userId) {
  await q("UPDATE instructors SET user_id=? WHERE id=?", [userId, instructorId]);
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
  const [[ins]] = await q("SELECT user_id FROM instructors WHERE id=?", [id]);
  await q("DELETE FROM course_instructors WHERE instructor_id=?", [id]);
  await q("UPDATE courses SET instructor_id=NULL WHERE instructor_id=?", [id]);
  await q("DELETE FROM instructors WHERE id=?", [id]);
  // Remove the linked login account, if any.
  if (ins && ins.user_id) {
    await q("DELETE FROM sessions WHERE user_id=?", [ins.user_id]);
    await q("DELETE FROM users WHERE id=? AND role='instructor'", [ins.user_id]);
  }
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
  await q("DELETE FROM content_groups WHERE course_id=?", [id]);
  await q("DELETE FROM enrolments WHERE course_id=?", [id]);
  await q("DELETE FROM course_instructors WHERE course_id=?", [id]);
  await q("UPDATE exams SET course_id='' WHERE course_id=?", [id]);
  await q("DELETE FROM courses WHERE id=?", [id]);
}
const ITEM_TABLE = { recordings: "recordings", links: "links", materials: "materials" };
async function addCourseItem(courseId, groupId, bucket, value) {
  const t = ITEM_TABLE[bucket];
  if (!t) return;
  const gid = Number(groupId) || 0;
  const [[{ p }]] = await q(`SELECT COALESCE(MAX(position),-1)+1 AS p FROM ${t} WHERE course_id=? AND group_id=?`, [courseId, gid]);
  if (bucket === "recordings") await q("INSERT INTO recordings (course_id,group_id,title,date,length,position) VALUES (?,?,?, 'n/a','n/a', ?)", [courseId, gid, value, p]);
  else if (bucket === "links") await q("INSERT INTO links (course_id,group_id,title,url,position) VALUES (?,?,?, '#', ?)", [courseId, gid, value, p]);
  else await q("INSERT INTO materials (course_id,group_id,title,size,ext,position) VALUES (?,?,?, 'n/a','PDF', ?)", [courseId, gid, value, p]);
}
async function removeCourseItem(courseId, bucket, itemId) {
  const t = ITEM_TABLE[bucket];
  if (t) await q(`DELETE FROM ${t} WHERE id=? AND course_id=?`, [itemId, courseId]);
}
async function reorderItems(courseId, bucket, orderedIds) {
  const t = ITEM_TABLE[bucket];
  if (!t || !Array.isArray(orderedIds)) return;
  for (let i = 0; i < orderedIds.length; i++) await q(`UPDATE ${t} SET position=? WHERE id=? AND course_id=?`, [i, orderedIds[i], courseId]);
}
async function addMaterialFile(courseId, groupId, f) {
  const gid = Number(groupId) || 0;
  const [[{ p }]] = await q("SELECT COALESCE(MAX(position),-1)+1 AS p FROM materials WHERE course_id=? AND group_id=?", [courseId, gid]);
  await q("INSERT INTO materials (course_id,group_id,title,size,ext,filename,position) VALUES (?,?,?,?,?,?,?)",
    [courseId, gid, f.title, f.size, f.ext, f.filename, p]);
}
async function getMaterial(id) {
  const [[r]] = await q("SELECT id, course_id, group_id, title, size, ext, filename FROM materials WHERE id=?", [id]);
  return r || null;
}
async function courseMaterialFiles(courseId, groupId) {
  const params = groupId == null ? [courseId] : [courseId, Number(groupId)];
  const where = groupId == null ? "course_id=?" : "course_id=? AND group_id=?";
  const [rows] = await q(`SELECT filename FROM materials WHERE ${where} AND filename IS NOT NULL AND filename<>''`, params);
  return rows.map((r) => r.filename);
}
async function instructorTeaches(userId, courseId) {
  const [[r]] = await q(
    `SELECT 1 AS x FROM instructors i JOIN course_instructors ci ON ci.instructor_id=i.id
     WHERE i.user_id=? AND ci.course_id=? LIMIT 1`, [userId, courseId]);
  return !!r;
}

/* ---- content groups ---- */
async function addGroup(courseId, title) {
  const [[{ p }]] = await q("SELECT COALESCE(MAX(position),-1)+1 AS p FROM content_groups WHERE course_id=?", [courseId]);
  const [r] = await q("INSERT INTO content_groups (course_id,title,position) VALUES (?,?,?)", [courseId, title, p]);
  return r.insertId;
}
async function renameGroup(courseId, gid, title) {
  await q("UPDATE content_groups SET title=? WHERE id=? AND course_id=?", [title, gid, courseId]);
}
async function deleteGroup(courseId, gid) {
  for (const t of ["recordings", "links", "materials"]) await q(`DELETE FROM ${t} WHERE course_id=? AND group_id=?`, [courseId, gid]);
  await q("DELETE FROM content_groups WHERE id=? AND course_id=?", [gid, courseId]);
}
async function reorderGroups(courseId, orderedIds) {
  if (!Array.isArray(orderedIds)) return;
  for (let i = 0; i < orderedIds.length; i++) await q("UPDATE content_groups SET position=? WHERE id=? AND course_id=?", [i, orderedIds[i], courseId]);
}
async function groupExists(courseId, gid) {
  const [[r]] = await q("SELECT id FROM content_groups WHERE id=? AND course_id=?", [gid, courseId]);
  return !!r;
}
/* ---- certificates ---- */
async function certExists(studentId, courseId) {
  const [[r]] = await q("SELECT id FROM certificates WHERE student_id=? AND course_id=?", [studentId, courseId]);
  return !!r;
}
async function issueCertificate(studentId, courseId, certNo, when) {
  await q("INSERT INTO certificates (cert_no,student_id,course_id,issued_at,downloaded,unlocked) VALUES (?,?,?,?,0,0)", [certNo, studentId, courseId, when]);
}
async function listCertificates() {
  const [rows] = await q(`SELECT c.id, c.cert_no, c.issued_at, c.downloaded, c.unlocked, c.student_id, c.course_id,
      u.name AS studentName, u.email AS studentEmail, co.title AS courseTitle, co.code AS courseCode
    FROM certificates c JOIN users u ON u.id=c.student_id JOIN courses co ON co.id=c.course_id
    ORDER BY c.issued_at DESC`);
  return rows;
}
async function getCertificate(id) {
  const [[r]] = await q(`SELECT c.*, u.name AS studentName, u.email AS studentEmail,
      co.title AS courseTitle, co.code AS courseCode, co.cert_template AS certTemplate
    FROM certificates c JOIN users u ON u.id=c.student_id JOIN courses co ON co.id=c.course_id WHERE c.id=?`, [id]);
  return r || null;
}
async function studentCertificates(studentId) {
  const [rows] = await q(`SELECT c.id, c.cert_no, c.issued_at, c.downloaded, c.unlocked,
      co.title AS courseTitle, co.code AS courseCode
    FROM certificates c JOIN courses co ON co.id=c.course_id WHERE c.student_id=? ORDER BY c.issued_at DESC`, [studentId]);
  return rows;
}
async function markCertDownloaded(id) { await q("UPDATE certificates SET downloaded=1, unlocked=0 WHERE id=?", [id]); }
async function unlockCertificate(id) { await q("UPDATE certificates SET unlocked=1 WHERE id=?", [id]); }

/* ---- backup / restore (data only; schema is recreated by init()) ---- */
async function dumpDatabase() {
  const [tables] = await q("SHOW TABLES");
  const key = tables.length ? Object.keys(tables[0])[0] : null;
  const names = tables.map((row) => row[key]).filter((t) => t !== "sessions"); // skip live login sessions
  let out = "-- Learning Portal data backup\nSET FOREIGN_KEY_CHECKS=0;\n";
  for (const t of names) {
    out += `DELETE FROM \`${t}\`;\n`;
    const [rows] = await q(`SELECT * FROM \`${t}\``);
    for (const r of rows) {
      const cols = Object.keys(r);
      const vals = cols.map((c) => pool.escape(r[c]));
      out += `INSERT INTO \`${t}\` (${cols.map((c) => "`" + c + "`").join(",")}) VALUES (${vals.join(",")});\n`;
    }
  }
  out += "SET FOREIGN_KEY_CHECKS=1;\n";
  return out;
}
async function runScript(sql) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    charset: "utf8mb4",
  });
  try { await conn.query(sql); } finally { await conn.end(); }
}

/* ---- exams ---- */
async function examsList() {
  const [rows] = await q(`SELECT e.id, e.course_id, e.title, e.question_count, e.time_limit, e.created_at,
      co.title AS courseTitle, co.code AS courseCode,
      (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id=e.id) AS bankSize,
      (SELECT COUNT(*) FROM exam_attempts ea WHERE ea.exam_id=e.id AND ea.finished_at IS NOT NULL) AS attempts
    FROM exams e LEFT JOIN courses co ON co.id=e.course_id ORDER BY e.id DESC`);
  return rows;
}
async function examMeta(id) {
  const [[e]] = await q(`SELECT e.*, co.title AS courseTitle, co.code AS courseCode
    FROM exams e LEFT JOIN courses co ON co.id=e.course_id WHERE e.id=?`, [id]);
  return e || null;
}
async function examFull(id) {
  const e = await examMeta(id);
  if (!e) return null;
  const [questions] = await q("SELECT id, question, options, correct, qtype, corrects FROM exam_questions WHERE exam_id=? ORDER BY position, id", [id]);
  const [attempts] = await q(`SELECT a.id, a.user_id, a.started_at, a.finished_at, a.score, a.total,
      u.name AS studentName, u.email AS studentEmail
    FROM exam_attempts a JOIN users u ON u.id=a.user_id WHERE a.exam_id=? AND a.finished_at IS NOT NULL
    ORDER BY a.finished_at DESC`, [id]);
  return {
    ...e,
    questions: questions.map((r) => ({
      id: r.id, question: r.question, options: JSON.parse(r.options),
      qtype: r.qtype || "single",
      corrects: r.corrects ? JSON.parse(r.corrects) : [r.correct],
    })),
    attempts,
  };
}
async function addExamQuestion(examId, question, options, qtype, corrects) {
  const [[{ p }]] = await q("SELECT COALESCE(MAX(position),-1)+1 AS p FROM exam_questions WHERE exam_id=?", [examId]);
  await q("INSERT INTO exam_questions (exam_id,question,options,correct,qtype,corrects,position) VALUES (?,?,?,?,?,?,?)",
    [examId, question, JSON.stringify(options), corrects[0], qtype, JSON.stringify(corrects), p]);
}
async function updateExamQuestion(examId, qid, question, options, qtype, corrects) {
  await q("UPDATE exam_questions SET question=?, options=?, correct=?, qtype=?, corrects=? WHERE id=? AND exam_id=?",
    [question, JSON.stringify(options), corrects[0], qtype, JSON.stringify(corrects), qid, examId]);
}
async function deleteExamQuestion(examId, qid) {
  await q("DELETE FROM exam_questions WHERE id=? AND exam_id=?", [qid, examId]);
}
async function clearExamQuestions(examId) {
  await q("DELETE FROM exam_questions WHERE exam_id=?", [examId]);
}
async function deleteExam(id) {
  await q("DELETE FROM exam_attempts WHERE exam_id=?", [id]);
  await q("DELETE FROM exam_questions WHERE exam_id=?", [id]);
  await q("DELETE FROM exams WHERE id=?", [id]);
}
async function latestAttempt(examId, userId) {
  const [[a]] = await q("SELECT * FROM exam_attempts WHERE exam_id=? AND user_id=? ORDER BY id DESC LIMIT 1", [examId, userId]);
  return a || null;
}
async function createAttempt(examId, userId, when, snapshot) {
  const [r] = await q("INSERT INTO exam_attempts (exam_id,user_id,started_at,snapshot) VALUES (?,?,?,?)", [examId, userId, when, snapshot]);
  return { id: r.insertId, started_at: when, snapshot };
}
async function finishAttempt(id, score, total, answers) {
  const [[a]] = await q("SELECT snapshot FROM exam_attempts WHERE id=?", [id]);
  let snap = {};
  try { snap = JSON.parse(a?.snapshot || "{}"); } catch { /* keep empty */ }
  snap.answers = answers;
  await q("UPDATE exam_attempts SET finished_at=?, score=?, total=?, snapshot=? WHERE id=?",
    [Date.now(), score, total, JSON.stringify(snap), id]);
}
async function studentAttemptsAdmin(userId) {
  const [rows] = await q(`SELECT a.id, a.exam_id, a.started_at, a.finished_at, a.score, a.total,
      e.title AS examTitle, e.course_id, co.title AS courseTitle, co.code AS courseCode
    FROM exam_attempts a JOIN exams e ON e.id=a.exam_id LEFT JOIN courses co ON co.id=e.course_id
    WHERE a.user_id=? AND a.finished_at IS NOT NULL ORDER BY a.finished_at DESC`, [userId]);
  return rows;
}
async function studentExams(userId) {
  const ids = await enrolledIds(userId);
  if (ids.length === 0) return [];
  const [rows] = await q(`SELECT e.id, e.course_id, e.title, e.question_count, e.time_limit,
      co.title AS courseTitle, co.code AS courseCode,
      (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id=e.id) AS bankSize
    FROM exams e JOIN courses co ON co.id=e.course_id WHERE e.course_id IN (?) ORDER BY e.id DESC`, [ids]);
  const out = [];
  for (const r of rows) {
    if (!r.bankSize) continue;
    const [[a]] = await q("SELECT id, started_at, finished_at, score, total FROM exam_attempts WHERE exam_id=? AND user_id=? ORDER BY id DESC LIMIT 1", [r.id, userId]);
    out.push({ ...r, attempt: a || null });
  }
  return out;
}

/* ---- first-admin setup ---- */
async function hasAdmin() {
  const [[r]] = await q("SELECT COUNT(*) AS n FROM users WHERE role='admin'");
  return r.n > 0;
}
async function createAdmin({ name, username, email, password }) {
  const parts = name.trim().split(/\s+/);
  const first = parts.shift() || "";
  const last = parts.join(" ");
  await q("INSERT INTO users (name,first_name,last_name,nickname,username,email,password_hash,role,status) VALUES (?,?,?, '', ?,?,?, 'admin','active')",
    [name.trim(), first, last, username, email, bcrypt.hashSync(password, 10)]);
}

/* ---- TEMPORARY: bulk sample data for testing (wipes existing data) ---- */
async function seedBulk() {
  const FIRST = ["Ravi", "Amara", "Dilan", "Nadeesha", "Kasun", "Sahan", "Tharindu", "Ishara", "Nuwan", "Chathura",
    "Hiruni", "Sanduni", "Pasan", "Gayan", "Malsha", "Dinithi", "Lakmal", "Roshan", "Tania", "Kavindi",
    "Janith", "Oshadi", "Buddhika", "Shenal", "Yasiru", "Maleesha", "Imasha", "Heshan", "Senura", "Nethmi"];
  const LAST = ["Perera", "Silva", "Fernando", "Jayawardena", "Bandara", "Wickramasinghe", "Rajapaksa", "Gunawardena",
    "Senanayake", "Dissanayake", "Herath", "Ratnayake", "Weerasinghe", "Karunaratne", "Ekanayake", "Mendis",
    "Wijesinghe", "Abeysekera", "Samaraweera", "Kumara"];
  const TITLES = ["Lead Mentor", "Senior Instructor", "Course Director", "Trading Coach", "Analyst", "Guest Lecturer"];
  const COURSE_TITLES = [
    "Foundations of Equity Markets", "Technical Analysis Masterclass", "Options & Derivatives", "Portfolio Construction & Risk",
    "Fundamental Analysis", "Candlestick Patterns", "Risk Management Essentials", "Algorithmic Trading Basics",
    "Forex Trading", "Commodities & Futures", "Behavioural Finance", "Macroeconomics for Traders",
    "Day Trading Strategies", "Swing Trading", "Value Investing", "Dividend Investing", "Crypto Market Structure",
    "Bond Markets", "Financial Statement Analysis", "Trading Psychology", "Market Microstructure", "Quantitative Methods",
    "ETFs & Index Funds", "Hedging Strategies", "Position Sizing", "Chart Pattern Recognition", "Economic Indicators",
    "Wealth Planning", "Capital Markets Law", "Intro to Investing"];
  const pick = (arr, i) => arr[i % arr.length];
  const pw = bcrypt.hashSync("test123", 10);
  const adminHash = bcrypt.hashSync("admin123", 10);

  for (const t of ["exam_attempts", "exam_questions", "exams", "certificates", "enrolments", "course_instructors",
    "recordings", "links", "materials", "content_groups", "courses", "instructors", "users", "sessions"]) {
    await q(`DELETE FROM ${t}`);
  }

  await q("INSERT INTO users (name,first_name,last_name,nickname,username,email,password_hash,role,status) VALUES (?,?,?, '', 'admin','admin@demo.lk', ?, 'admin','active')",
    ["Admin User", "Admin", "User", adminHash]);

  // 20 instructors (4 of them get logins: instr1..instr4 / test123)
  const instructorIds = [];
  for (let i = 0; i < 20; i++) {
    const first = pick(FIRST, i * 2 + 1);
    const last = pick(LAST, i);
    const [r] = await q("INSERT INTO instructors (name,email,phone,title,bio,gender,notes) VALUES (?,?,?,?,?,?, '')",
      [`${first} ${last}`, `instructor${i + 1}@demo.lk`, `+94 71${String(2000000 + i).slice(0, 7)}`, pick(TITLES, i), "Experienced markets mentor.", i % 3 === 0 ? "Female" : "Male"]);
    instructorIds.push(r.insertId);
  }
  for (let i = 0; i < 4; i++) {
    const [[ins]] = await q("SELECT name, email FROM instructors WHERE id=?", [instructorIds[i]]);
    const parts = ins.name.split(" ");
    const [u] = await q("INSERT INTO users (name,first_name,last_name,nickname,username,email,password_hash,role,status) VALUES (?,?,?, '', ?,?,?, 'instructor','active')",
      [ins.name, parts[0], parts.slice(1).join(" "), "instr" + (i + 1), ins.email, pw]);
    await q("UPDATE instructors SET user_id=? WHERE id=?", [u.insertId, instructorIds[i]]);
  }

  // 30 courses with instructors, groups and content
  const courseIds = [];
  for (let i = 0; i < 30; i++) {
    const id = "c" + (i + 1);
    const code = "C-" + (101 + i);
    const title = COURSE_TITLES[i] || ("Course " + (i + 1));
    await q("INSERT INTO courses (id,code,title,instructor,blurb,sessions,cert_template) VALUES (?,?,?, '', ?, ?, '')",
      [id, code, title, "A comprehensive programme on " + title.toLowerCase() + ".", 4 + (i % 9)]);
    for (let j = 0; j <= i % 3; j++) await q("INSERT IGNORE INTO course_instructors (course_id,instructor_id) VALUES (?,?)", [id, instructorIds[(i + j) % 20]]);
    for (let g = 0; g <= i % 3; g++) {
      const [gr] = await q("INSERT INTO content_groups (course_id,title,position) VALUES (?,?,?)", [id, "Module " + (g + 1), g]);
      const gid = gr.insertId;
      for (let k = 0; k < 2; k++) await q("INSERT INTO recordings (course_id,group_id,title,date,length,position) VALUES (?,?,?, 'n/a','n/a', ?)", [id, gid, `Lecture ${g + 1}.${k + 1}`, k]);
      await q("INSERT INTO links (course_id,group_id,title,url,position) VALUES (?,?,?, '#', 0)", [id, gid, `Reference reading ${g + 1}`]);
      await q("INSERT INTO materials (course_id,group_id,title,size,ext,position) VALUES (?,?,?, 'n/a','PDF', 0)", [id, gid, `Module ${g + 1} notes`]);
    }
    courseIds.push(id);
  }

  // 50 students (40 active, 6 inactive, 4 invited) + random enrolments
  const studentIds = [];
  for (let i = 0; i < 50; i++) {
    const first = pick(FIRST, i);
    const last = pick(LAST, i * 2 + 1);
    const status = i < 40 ? "active" : i < 46 ? "inactive" : "invited";
    const invited = status === "invited";
    const [r] = await q("INSERT INTO users (name,first_name,last_name,nickname,phone,gender,username,email,password_hash,role,status,reg_token) VALUES (?,?,?, '', ?, ?, ?, ?, ?, 'student', ?, ?)",
      [`${first} ${last}`, first, last, `+94 76${String(1000000 + i).slice(0, 7)}`, i % 2 === 0 ? "Male" : "Female",
        "student" + (i + 1), `student${i + 1}@demo.lk`, invited ? "" : pw, status, invited ? "seedtok" + i : null]);
    studentIds.push(r.insertId);
    if (!invited) {
      const seen = new Set();
      for (let j = 0; j < i % 6; j++) {
        const cid = courseIds[(i * 3 + j * 7) % 30];
        if (seen.has(cid)) continue;
        seen.add(cid);
        await q("INSERT IGNORE INTO enrolments (user_id,course_id) VALUES (?,?)", [r.insertId, cid]);
      }
    }
  }

  // 10 exams (89 questions total), assigned to courses
  let questions = 0;
  for (let i = 0; i < 10; i++) {
    const cid = courseIds[(i * 3) % 30];
    const qCount = 8 + (i % 3);
    const [ex] = await q("INSERT INTO exams (course_id,title,question_count,time_limit,created_at) VALUES (?,?,?,?,?)",
      [cid, `Assessment ${i + 1}`, Math.min(6, qCount), [0, 15, 30, 60][i % 4], Date.now()]);
    for (let k = 0; k < qCount; k++) {
      const multi = k % 4 === 3;
      const corrects = multi ? [0, 2] : [k % 4];
      await q("INSERT INTO exam_questions (exam_id,question,options,correct,qtype,corrects,position) VALUES (?,?,?,?,?,?,?)",
        [ex.insertId, `Sample question ${k + 1} for assessment ${i + 1}?`, JSON.stringify(["Option A", "Option B", "Option C", "Option D"]),
          corrects[0], multi ? "multi" : "single", JSON.stringify(corrects), k]);
      questions++;
    }
  }

  // some certificates + finished exam attempts so lists/results have data
  const [enrol] = await q("SELECT user_id, course_id FROM enrolments LIMIT 15");
  for (const e of enrol) {
    await q("INSERT INTO certificates (cert_no,student_id,course_id,issued_at,downloaded,unlocked) VALUES (?,?,?,?,0,0)",
      ["CERT-SEED-" + e.user_id + "-" + e.course_id, e.user_id, e.course_id, Date.now()]);
  }
  const [examRows] = await q("SELECT id, course_id FROM exams");
  for (const ex of examRows) {
    const [studs] = await q("SELECT user_id FROM enrolments WHERE course_id=? LIMIT 3", [ex.course_id]);
    const [qs] = await q("SELECT options, corrects FROM exam_questions WHERE exam_id=?", [ex.id]);
    if (!qs.length) continue;
    const snapQs = qs.map((r) => ({ qtype: "single", question: "", options: JSON.parse(r.options), corrects: JSON.parse(r.corrects || "[0]") }));
    for (const s of studs) {
      const now = Date.now();
      await q("INSERT INTO exam_attempts (exam_id,user_id,started_at,finished_at,score,total,snapshot) VALUES (?,?,?,?,?,?,?)",
        [ex.id, s.user_id, now - 600000, now, Math.round(snapQs.length * 0.7), snapQs.length, JSON.stringify({ questions: snapQs, answers: [] })]);
    }
  }

  return { students: 50, instructors: 20, courses: 30, exams: 10, questions };
}

async function getBrand() {
  const [[row]] = await q("SELECT v FROM settings WHERE k='brand'");
  return row ? JSON.parse(row.v) : { company: "", name: "Learning Portal", logo: "" };
}
async function setBrandValue(brand) {
  await q("INSERT INTO settings (k,v) VALUES ('brand',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify(brand)]);
  return brand;
}

const HCAPTCHA_DEFAULT = { enabled: false, siteKey: "", secretKey: "" };
async function getHcaptcha() {
  const [[row]] = await q("SELECT v FROM settings WHERE k='hcaptcha'");
  return row ? { ...HCAPTCHA_DEFAULT, ...JSON.parse(row.v) } : { ...HCAPTCHA_DEFAULT };
}
async function getHcaptchaForClient() {
  const { enabled, siteKey, secretKey } = await getHcaptcha();
  return { enabled: !!enabled && !!siteKey, siteKey, hasSecretKey: !!secretKey };
}
async function setHcaptcha(next) {
  const cur = await getHcaptcha();
  const merged = { ...cur, ...next };
  if (next.secretKey === undefined || next.secretKey === "") merged.secretKey = cur.secretKey;
  await q("INSERT INTO settings (k,v) VALUES ('hcaptcha',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify(merged)]);
  return getHcaptchaForClient();
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
  instructorByUserId, coursesForInstructor, linkInstructorUser,
  addCourseInstructor, removeCourseInstructor,
  addCourseItem, removeCourseItem, reorderItems,
  addMaterialFile, getMaterial, courseMaterialFiles, instructorTeaches,
  addGroup, renameGroup, deleteGroup, reorderGroups, groupExists,
  dumpDatabase, runScript,
  certExists, issueCertificate, listCertificates, getCertificate, studentCertificates, markCertDownloaded, unlockCertificate,
  examsList, examMeta, examFull, addExamQuestion, updateExamQuestion, deleteExamQuestion, clearExamQuestions, deleteExam,
  latestAttempt, createAttempt, finishAttempt, studentExams, studentAttemptsAdmin,
  getBrand, setBrandValue, getSmtp, getSmtpForClient, setSmtp,
  getHcaptcha, getHcaptchaForClient, setHcaptcha,
  hasAdmin, createAdmin, seedBulk,
};
