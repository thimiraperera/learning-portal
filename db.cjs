/* MySQL data layer for the Learning Portal.
   Credentials come from environment variables (set in the cPanel Node.js App
   UI, or a local .env file). Nothing secret is committed to the repo.
   On first run it creates the schema, migrates older databases, and seeds
   demo data with hashed passwords. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

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

// All tables use this one collation. Pinning it keeps JOINs from breaking when
// the MySQL/MariaDB server default differs between table creations (newer
// MariaDB defaults new tables to utf8mb4_uca1400_ai_ci, older ones to
// utf8mb4_general_ci, and mixing the two makes string '=' comparisons fail).
const COLLATE = "utf8mb4_general_ci";

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
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS courses (
     id VARCHAR(32) PRIMARY KEY, code VARCHAR(40) NOT NULL, title VARCHAR(255) NOT NULL,
     instructor VARCHAR(255), instructor_id INT, blurb TEXT, sessions INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS instructors (
     id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL,
     email VARCHAR(190), phone VARCHAR(60), title VARCHAR(190), bio TEXT,
     gender VARCHAR(20) DEFAULT '', notes TEXT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS course_instructors (
     course_id VARCHAR(32) NOT NULL, instructor_id INT NOT NULL,
     PRIMARY KEY (course_id, instructor_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS content_groups (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, title VARCHAR(255) NOT NULL, position INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS recordings (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, group_id INT DEFAULT 0, title VARCHAR(255) NOT NULL, date VARCHAR(64), length VARCHAR(64), position INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS links (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, group_id INT DEFAULT 0, title VARCHAR(255) NOT NULL, url TEXT, position INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS materials (
     id INT AUTO_INCREMENT PRIMARY KEY, course_id VARCHAR(32) NOT NULL, group_id INT DEFAULT 0, title VARCHAR(255) NOT NULL, size VARCHAR(40), ext VARCHAR(16), filename VARCHAR(512), position INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS enrolments (
     user_id INT NOT NULL, course_id VARCHAR(32) NOT NULL, PRIMARY KEY (user_id, course_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS settings (
     k VARCHAR(64) PRIMARY KEY, v LONGTEXT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token VARCHAR(64) PRIMARY KEY, user_id INT NOT NULL, created_at BIGINT, expires_at BIGINT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS certificates (
     id INT AUTO_INCREMENT PRIMARY KEY, cert_no VARCHAR(40) NOT NULL UNIQUE,
     student_id INT NOT NULL, course_id VARCHAR(32) NOT NULL, issued_at BIGINT,
     downloaded TINYINT DEFAULT 0, unlocked TINYINT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS exams (
     id INT AUTO_INCREMENT PRIMARY KEY,
     course_id VARCHAR(32) DEFAULT '',
     title VARCHAR(255) NOT NULL,
     question_count INT DEFAULT 0,
     time_limit INT DEFAULT 0,
     created_at BIGINT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS exam_questions (
     id INT AUTO_INCREMENT PRIMARY KEY,
     exam_id INT NOT NULL,
     question TEXT NOT NULL,
     options TEXT NOT NULL,
     correct INT DEFAULT 0,
     qtype VARCHAR(10) DEFAULT 'single',
     corrects TEXT,
     position INT DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS exam_attempts (
     id INT AUTO_INCREMENT PRIMARY KEY,
     exam_id INT NOT NULL,
     user_id INT NOT NULL,
     started_at BIGINT,
     finished_at BIGINT,
     score DECIMAL(6,2) DEFAULT 0,
     total INT DEFAULT 0,
     snapshot LONGTEXT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS course_requests (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL, course_id VARCHAR(32) NOT NULL, created_at BIGINT,
     UNIQUE KEY uniq_req (user_id, course_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS payment_plans (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL, course_id VARCHAR(32) NOT NULL,
     total_fee DECIMAL(12,2) DEFAULT 0, reg_fee DECIMAL(12,2) DEFAULT 0,
     due_date VARCHAR(20) DEFAULT '', created_at BIGINT,
     UNIQUE KEY uniq_plan (user_id, course_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS payments (
     id INT AUTO_INCREMENT PRIMARY KEY,
     plan_id INT NOT NULL, amount DECIMAL(12,2) DEFAULT 0,
     note VARCHAR(255) DEFAULT '', paid_at BIGINT, created_at BIGINT
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS payment_installments (
     id INT AUTO_INCREMENT PRIMARY KEY,
     plan_id INT NOT NULL, seq INT DEFAULT 0,
     label VARCHAR(64) DEFAULT '', amount DECIMAL(12,2) DEFAULT 0, due_date VARCHAR(20) DEFAULT ''
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS course_payment_plans (
     course_id VARCHAR(32) PRIMARY KEY,
     total_fee DECIMAL(12,2) DEFAULT 0, reg_fee DECIMAL(12,2) DEFAULT 0, installments INT DEFAULT 0,
     start_date VARCHAR(20) DEFAULT '', completion_date VARCHAR(20) DEFAULT ''
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
];

// Returns true when the column was just created (lets callers backfill once).
async function ensureColumn(table, col, decl) {
  const [rows] = await q(
    "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?",
    [table, col]
  );
  if (rows[0].n === 0) { await q(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`); return true; }
  return false;
}

function displayName(u) {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return (u.nickname && u.nickname.trim()) || full || u.username;
}

/* On a fresh database (no admin yet) create the first administrator from
   environment variables, so a new install has a login without any demo data.
   Defaults to admin / admin123 if the ADMIN_* vars are not set. */
async function ensureAdmin() {
  if (await hasAdmin()) return;
  const username = String(process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const email = String(process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "admin123");
  const name = String(process.env.ADMIN_NAME || "Administrator");
  const [[clash]] = await q("SELECT 1 AS x FROM users WHERE lower(username)=? OR lower(email)=? LIMIT 1", [username, email]);
  if (clash) return; // a non-admin already uses these credentials; leave it alone
  await createAdmin({ name, username, email, password, superAdmin: true });
  const [[brand]] = await q("SELECT 1 AS x FROM settings WHERE k='brand'");
  if (!brand) await q("INSERT INTO settings (k,v) VALUES ('brand',?)", [JSON.stringify({ company: "", name: "Learning Portal", logo: "" })]);
  console.log(`Created initial admin '${username}' (set ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL / ADMIN_NAME to customise).`);
}

// Force every table onto the one collation. Older databases can hold a mix
// (e.g. utf8mb4_general_ci alongside utf8mb4_uca1400_ai_ci) which makes
// cross-table string JOINs throw "Illegal mix of collations". Converting any
// stragglers here lets a plain deploy self-heal without manual SQL.
async function normalizeCollations() {
  const [tables] = await q(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema=DATABASE() AND table_collation<>?",
    [COLLATE]
  );
  for (const row of tables) {
    await q(`ALTER TABLE \`${row.t}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE ${COLLATE}`);
  }
}

async function init() {
  for (const sql of TABLES) await q(sql);
  await normalizeCollations();
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
  await ensureColumn("recordings", "url", "TEXT");
  await ensureColumn("materials", "url", "TEXT");
  await ensureColumn("sessions", "expires_at", "BIGINT");
  await ensureColumn("users", "reset_token", "VARCHAR(64)");
  await ensureColumn("users", "reset_expires", "BIGINT");
  await ensureColumn("courses", "instructor_id", "INT");
  await ensureColumn("courses", "cert_template", "VARCHAR(64) DEFAULT ''");
  await ensureColumn("exam_questions", "qtype", "VARCHAR(10) DEFAULT 'single'");
  await ensureColumn("exam_questions", "corrects", "TEXT");
  await ensureColumn("users", "totp_secret", "VARCHAR(64)");
  await ensureColumn("users", "totp_enabled", "TINYINT DEFAULT 0");
  await ensureColumn("instructors", "user_id", "INT");
  await ensureColumn("users", "nic", "VARCHAR(40) DEFAULT ''");
  await ensureColumn("users", "reg_no", "VARCHAR(64) DEFAULT ''");
  await ensureColumn("enrolments", "locked", "TINYINT DEFAULT 0");
  await ensureColumn("payment_plans", "last_reminded", "BIGINT");
  // Admin tiers: super admins have full access (incl. Settings); local admins do not.
  // When the column is first added, promote every existing admin to super so no one
  // loses access on upgrade; new local admins default to 0.
  if (await ensureColumn("users", "super_admin", "TINYINT DEFAULT 0")) {
    await q("UPDATE users SET super_admin=1 WHERE role='admin'");
  }
  // Checkbox questions earn partial marks, so attempt scores can be fractional.
  await q("ALTER TABLE exam_attempts MODIFY score DECIMAL(6,2) DEFAULT 0");
  const [needs] = await q("SELECT id, name FROM users WHERE COALESCE(first_name,'')='' AND COALESCE(last_name,'')=''");
  for (const u of needs) {
    const parts = String(u.name || "").trim().split(/\s+/);
    await q("UPDATE users SET first_name=?, last_name=? WHERE id=?", [parts.shift() || "", parts.join(" "), u.id]);
  }
  await ensureAdmin();
  // Give every student a registration number. Existing students (e.g. imported
  // directly) get one here in id order; new ones get theirs at invite time.
  const [noReg] = await q("SELECT id FROM users WHERE role='student' AND COALESCE(reg_no,'')='' ORDER BY id");
  for (const r of noReg) await assignRegNo(r.id);
  // Migrate older single-due-date plans into the installment schedule: a
  // registration line plus a balance installment, using the old due date.
  const [oldPlans] = await q(`SELECT p.id, p.total_fee, p.reg_fee, p.due_date FROM payment_plans p
     WHERE NOT EXISTS (SELECT 1 FROM payment_installments i WHERE i.plan_id=p.id)`);
  for (const p of oldPlans) {
    const total = Number(p.total_fee) || 0, reg = Number(p.reg_fee) || 0, due = p.due_date || "";
    if (total <= 0 && reg <= 0) continue;
    let seq = 1;
    if (reg > 0) await q("INSERT INTO payment_installments (plan_id,seq,label,amount,due_date) VALUES (?,?,?,?,?)", [p.id, seq++, "Registration fee", Math.min(reg, total || reg), due]);
    const bal = Math.max(0, total - reg);
    if (bal > 0) await q("INSERT INTO payment_installments (plan_id,seq,label,amount,due_date) VALUES (?,?,?,?,?)", [p.id, seq++, "Installment 1", bal, due]);
    if (reg <= 0 && bal <= 0 && total > 0) await q("INSERT INTO payment_installments (plan_id,seq,label,amount,due_date) VALUES (?,?,?,?,?)", [p.id, 1, "Full payment", total, due]);
  }
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
  const [recordings] = await q("SELECT id, group_id, title AS t, url AS u FROM recordings WHERE course_id=? ORDER BY position, id", [id]);
  const [links] = await q("SELECT id, group_id, title AS t, url AS u FROM links WHERE course_id=? ORDER BY position, id", [id]);
  const [materials] = await q("SELECT id, group_id, title AS t, size, ext, filename, url AS u FROM materials WHERE course_id=? ORDER BY position, id", [id]);
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
  const [rows] = await q("SELECT id FROM courses ORDER BY id DESC"); // newest first
  const map = {};
  for (const { id } of rows) if (!ids || ids.includes(id)) map[id] = await courseFull(id);
  return map;
}
async function enrolledIds(userId) {
  const [rows] = await q("SELECT course_id FROM enrolments WHERE user_id=?", [userId]);
  return rows.map((r) => r.course_id);
}

/* ---- per-student course access lock ---- */
// A locked enrolment keeps the student enrolled but blocks access to that
// course's content (used when a student has not paid, or any other reason).
async function setCourseLock(userId, courseId, locked) {
  await q("UPDATE enrolments SET locked=? WHERE user_id=? AND course_id=?", [locked ? 1 : 0, userId, courseId]);
}
async function lockedCourseIds(userId) {
  const [rows] = await q("SELECT course_id FROM enrolments WHERE user_id=? AND locked=1", [userId]);
  return rows.map((r) => r.course_id);
}
async function isCourseLocked(userId, courseId) {
  const [[r]] = await q("SELECT locked FROM enrolments WHERE user_id=? AND course_id=?", [userId, courseId]);
  return !!(r && r.locked);
}

/* ---- course enrolment requests ---- */
async function createRequest(userId, courseId) {
  await q("INSERT IGNORE INTO course_requests (user_id,course_id,created_at) VALUES (?,?,?)", [userId, courseId, Date.now()]);
}
async function studentRequestIds(userId) {
  const [rows] = await q("SELECT course_id FROM course_requests WHERE user_id=?", [userId]);
  return rows.map((r) => r.course_id);
}
async function pendingRequests() {
  const [rows] = await q(`SELECT r.id, r.user_id, r.course_id, r.created_at,
      u.name AS studentName, u.email AS studentEmail, co.code AS courseCode, co.title AS courseTitle
    FROM course_requests r JOIN users u ON u.id=r.user_id JOIN courses co ON co.id=r.course_id
    ORDER BY r.created_at DESC`); // newest first
  return rows;
}
async function getRequest(id) {
  const [[r]] = await q("SELECT * FROM course_requests WHERE id=?", [id]);
  return r || null;
}
async function deleteRequest(id) { await q("DELETE FROM course_requests WHERE id=?", [id]); }
async function clearRequest(userId, courseId) { await q("DELETE FROM course_requests WHERE user_id=? AND course_id=?", [userId, courseId]); }
async function lockedCourses(ids) {
  const [rows] = await q("SELECT id, code, title, blurb, sessions FROM courses ORDER BY id DESC"); // newest first
  return rows.filter((c) => !ids.includes(c.id));
}
/* ---- installment payment tracking ---- */
/* A plan is a registration fee plus a list of installments, each with an amount
   and a due date. Recorded payments are one pool applied to the schedule in
   order (a "waterfall"): each installment is filled before money flows to the
   next, and any extra carries forward. Everything below is computed live so
   totals and statuses never drift. */
function buildPlan(p, insts, pays, today) {
  // Work in integer cents so the waterfall and the plan-level totals can never
  // disagree by a floating-point epsilon (which would otherwise show "Paid"
  // next to a still-partial installment, or email a fully-paid student).
  const cents = (v) => Math.round(Number(v) * 100);
  const totalPaidC = pays.reduce((n, x) => n + cents(x.amount), 0);
  let runningC = totalPaidC;
  const installments = insts.map((it) => {
    const amountC = cents(it.amount);
    const coveredC = Math.min(runningC, amountC);
    runningC = Math.max(0, runningC - amountC);
    const fullyPaid = amountC > 0 ? coveredC >= amountC : true;
    const overdue = !fullyPaid && it.due_date && it.due_date < today;
    const status = fullyPaid ? "paid" : overdue ? "missed" : coveredC > 0 ? "partial" : "upcoming";
    return { id: it.id, seq: it.seq, label: it.label, amount: amountC / 100, due_date: it.due_date || "", covered: coveredC / 100, status };
  });
  const totalC = installments.reduce((n, x) => n + cents(x.amount), 0);
  const missedCount = installments.filter((x) => x.status === "missed").length;
  // First installment that is not fully paid; drives both nextDue and the plan
  // status, so the plan badge always agrees with the schedule rows.
  const next = installments.find((x) => x.status !== "paid") || null;
  const status = installments.length === 0 ? "empty"
    : !next ? "paid"
      : missedCount > 0 ? "overdue"
        : totalPaidC > 0 ? "partial" : "pending";
  return {
    id: p.id, user_id: p.user_id, course_id: p.course_id,
    courseCode: p.courseCode, courseTitle: p.courseTitle,
    studentName: p.studentName, studentEmail: p.studentEmail, studentStatus: p.studentStatus, studentRegNo: p.studentRegNo,
    last_reminded: p.last_reminded,
    installments,
    payments: pays.map((x) => ({ id: x.id, amount: Number(x.amount), note: x.note, paid_at: x.paid_at })),
    total: totalC / 100, paid: totalPaidC / 100,
    remaining: Math.max(0, totalC - totalPaidC) / 100, missedCount,
    nextDue: next ? { label: next.label, amount: next.amount, due_date: next.due_date, status: next.status } : null,
    status,
  };
}
// Enrich plan rows with their schedule + payments using two batched queries.
async function enrichPlans(planRows) {
  if (!planRows.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  const ids = planRows.map((p) => p.id);
  const ph = ids.map(() => "?").join(",");
  const [insts] = await q(`SELECT id, plan_id, seq, label, amount, due_date FROM payment_installments WHERE plan_id IN (${ph}) ORDER BY seq, id`, ids);
  const [pays] = await q(`SELECT id, plan_id, amount, note, paid_at FROM payments WHERE plan_id IN (${ph}) ORDER BY paid_at, id`, ids);
  const byI = {}; for (const r of insts) (byI[r.plan_id] ||= []).push(r);
  const byP = {}; for (const r of pays) (byP[r.plan_id] ||= []).push(r);
  return planRows.map((p) => buildPlan(p, byI[p.id] || [], byP[p.id] || [], today));
}
async function studentPlans(userId) {
  const [plans] = await q(`SELECT p.id, p.user_id, p.course_id, p.created_at, p.last_reminded,
       co.code AS courseCode, co.title AS courseTitle
     FROM payment_plans p JOIN courses co ON co.id=p.course_id
     WHERE p.user_id=? ORDER BY co.title`, [userId]);
  return enrichPlans(plans);
}
async function allPlans() {
  const [plans] = await q(`SELECT p.id, p.user_id, p.course_id, p.created_at, p.last_reminded,
       u.name AS studentName, u.email AS studentEmail, u.status AS studentStatus, u.reg_no AS studentRegNo,
       co.code AS courseCode, co.title AS courseTitle
     FROM payment_plans p
     JOIN users u ON u.id=p.user_id
     JOIN courses co ON co.id=p.course_id
     ORDER BY p.created_at DESC, p.id DESC`); // newest first
  return enrichPlans(plans);
}
// Replace a plan's whole schedule. items: [{label, amount, dueDate}] in order
// (the first is the registration fee). Creates the plan row if it is new.
async function setPlanSchedule(userId, courseId, items) {
  await q(`INSERT INTO payment_plans (user_id,course_id,created_at) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE course_id=VALUES(course_id)`, [userId, courseId, Date.now()]);
  const [[plan]] = await q("SELECT id FROM payment_plans WHERE user_id=? AND course_id=?", [userId, courseId]);
  await q("DELETE FROM payment_installments WHERE plan_id=?", [plan.id]);
  let seq = 1;
  for (const it of items) {
    await q("INSERT INTO payment_installments (plan_id,seq,label,amount,due_date) VALUES (?,?,?,?,?)",
      [plan.id, seq, String(it.label || `Installment ${seq}`).slice(0, 64), Math.max(0, Number(it.amount) || 0), String(it.dueDate || "").slice(0, 20)]);
    seq++;
  }
  return plan.id;
}
async function planById(planId) {
  const [[p]] = await q("SELECT * FROM payment_plans WHERE id=?", [planId]);
  return p || null;
}
async function deletePlan(userId, courseId) {
  const [[p]] = await q("SELECT id FROM payment_plans WHERE user_id=? AND course_id=?", [userId, courseId]);
  if (!p) return;
  await q("DELETE FROM payments WHERE plan_id=?", [p.id]);
  await q("DELETE FROM payment_installments WHERE plan_id=?", [p.id]);
  await q("DELETE FROM payment_plans WHERE id=?", [p.id]);
}
async function addPayment(planId, amount, note, paidAt) {
  await q("INSERT INTO payments (plan_id,amount,note,paid_at,created_at) VALUES (?,?,?,?,?)", [planId, amount, note, paidAt, Date.now()]);
}
async function paymentOwnerUser(paymentId) {
  const [[r]] = await q("SELECT p.user_id FROM payments pay JOIN payment_plans p ON p.id=pay.plan_id WHERE pay.id=?", [paymentId]);
  return r ? r.user_id : null;
}
async function deletePayment(paymentId) { await q("DELETE FROM payments WHERE id=?", [paymentId]); }
// Active, still-enrolled students with at least one missed installment.
// Feeds the admin Payments badge and the overdue reminder emails.
async function overduePayments() {
  const [plans] = await q(`SELECT p.id, p.user_id, p.course_id, p.created_at, p.last_reminded,
       u.name AS studentName, u.email AS studentEmail, u.status AS studentStatus, u.reg_no AS studentRegNo,
       co.code AS courseCode, co.title AS courseTitle
     FROM payment_plans p
     JOIN users u ON u.id=p.user_id
     JOIN courses co ON co.id=p.course_id
     WHERE u.role='student' AND u.status='active'
       AND EXISTS (SELECT 1 FROM enrolments e WHERE e.user_id=p.user_id AND e.course_id=p.course_id)`);
  return (await enrichPlans(plans)).filter((p) => p.missedCount > 0);
}

/* ---- course-level installment plan template ---- */
// A reusable default schedule for a course (registration fee + N installments,
// spread between a start and a completion date). The admin applies it to all
// enrolled students, which writes each student's own schedule.
async function getCoursePlan(courseId) {
  const [[row]] = await q("SELECT * FROM course_payment_plans WHERE course_id=?", [courseId]);
  if (!row) return { total_fee: 0, reg_fee: 0, installments: 0, start_date: "", completion_date: "" };
  return { total_fee: Number(row.total_fee), reg_fee: Number(row.reg_fee), installments: row.installments, start_date: row.start_date || "", completion_date: row.completion_date || "" };
}
async function setCoursePlan(courseId, f) {
  const total = Math.max(0, Number(f.total_fee) || 0);
  const reg = Math.max(0, Number(f.reg_fee) || 0);
  const inst = Math.max(0, Math.min(36, Math.floor(Number(f.installments) || 0)));
  await q(`INSERT INTO course_payment_plans (course_id,total_fee,reg_fee,installments,start_date,completion_date) VALUES (?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE total_fee=VALUES(total_fee), reg_fee=VALUES(reg_fee), installments=VALUES(installments), start_date=VALUES(start_date), completion_date=VALUES(completion_date)`,
    [courseId, total, reg, inst, String(f.start_date || "").slice(0, 20), String(f.completion_date || "").slice(0, 20)]);
  return getCoursePlan(courseId);
}

async function usersMap() {
  const [rows] = await q("SELECT * FROM users WHERE role='student' ORDER BY id DESC"); // newest first
  const map = {};
  for (const u of rows) {
    map[u.email] = {
      id: u.id, name: displayName(u), username: u.username, email: u.email,
      firstName: u.first_name || "", lastName: u.last_name || "", nickname: u.nickname || "", phone: u.phone || "",
      gender: u.gender || "", notes: u.notes || "", avatar: u.avatar || "",
      nic: u.nic || "", reg_no: u.reg_no || "",
      role: u.role, status: u.status, enrolled: await enrolledIds(u.id), lockedCourses: await lockedCourseIds(u.id),
    };
  }
  return map;
}
async function inviteStudent({ name, email, username, token }) {
  const parts = name.trim().split(/\s+/);
  const first = parts.shift() || "";
  const last = parts.join(" ");
  const [r] = await q("INSERT INTO users (name,first_name,last_name,nickname,phone,username,email,password_hash,role,status,reg_token) VALUES (?,?,?, '','', ?,?, '', 'student','invited', ?)",
    [name.trim(), first, last, username, email, token]);
  await assignRegNo(r.insertId);
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
  await q("UPDATE users SET first_name=?, last_name=?, nickname=?, phone=?, gender=?, notes=?, nic=?, email=?, name=? WHERE id=? AND role='student'",
    [f.firstName, f.lastName, f.nickname, f.phone, f.gender || "", f.notes || "", f.nic || "", f.email, name || f.email, id]);
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
    FROM instructors i LEFT JOIN users u ON u.id=i.user_id ORDER BY i.id DESC`); // newest first
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
  await q("DELETE FROM payments WHERE plan_id IN (SELECT id FROM payment_plans WHERE course_id=?)", [id]);
  await q("DELETE FROM payment_installments WHERE plan_id IN (SELECT id FROM payment_plans WHERE course_id=?)", [id]);
  await q("DELETE FROM payment_plans WHERE course_id=?", [id]);
  await q("DELETE FROM course_payment_plans WHERE course_id=?", [id]);
  await q("DELETE FROM courses WHERE id=?", [id]);
}
const ITEM_TABLE = { recordings: "recordings", links: "links", materials: "materials" };
async function addCourseItem(courseId, groupId, bucket, title, url) {
  const t = ITEM_TABLE[bucket];
  if (!t) return;
  const gid = Number(groupId) || 0;
  const u = String(url || "").trim();
  const [[{ p }]] = await q(`SELECT COALESCE(MAX(position),-1)+1 AS p FROM ${t} WHERE course_id=? AND group_id=?`, [courseId, gid]);
  if (bucket === "recordings") await q("INSERT INTO recordings (course_id,group_id,title,url,date,length,position) VALUES (?,?,?,?, '','', ?)", [courseId, gid, title, u, p]);
  else if (bucket === "links") await q("INSERT INTO links (course_id,group_id,title,url,position) VALUES (?,?,?,?, ?)", [courseId, gid, title, u, p]);
  else await q("INSERT INTO materials (course_id,group_id,title,url,size,ext,position) VALUES (?,?,?,?, '','LINK', ?)", [courseId, gid, title, u, p]);
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

/* ---- password reset ---- */
async function findLoginUser(idOrEmail) {
  const v = String(idOrEmail || "").trim().toLowerCase();
  if (!v) return null;
  const [[u]] = await q("SELECT * FROM users WHERE lower(username)=? OR lower(email)=? LIMIT 1", [v, v]);
  return u || null;
}
async function setResetToken(userId, token, expires) {
  await q("UPDATE users SET reset_token=?, reset_expires=? WHERE id=?", [token, expires, userId]);
}
async function getResetUser(token) {
  const [[u]] = await q("SELECT id, name FROM users WHERE reset_token=? AND reset_expires > ?", [token, Date.now()]);
  return u || null;
}
async function applyReset(token, passwordHash) {
  const [r] = await q("UPDATE users SET password_hash=?, reset_token=NULL, reset_expires=NULL WHERE reset_token=? AND reset_expires > ?",
    [passwordHash, token, Date.now()]);
  return r.affectedRows > 0;
}

/* ---- first-admin setup ---- */
async function hasAdmin() {
  const [[r]] = await q("SELECT COUNT(*) AS n FROM users WHERE role='admin'");
  return r.n > 0;
}
async function createAdmin({ name, username, email, password, superAdmin = false }) {
  const parts = name.trim().split(/\s+/);
  const first = parts.shift() || "";
  const last = parts.join(" ");
  await q("INSERT INTO users (name,first_name,last_name,nickname,username,email,password_hash,role,status,super_admin) VALUES (?,?,?, '', ?,?,?, 'admin','active', ?)",
    [name.trim(), first, last, username, email, bcrypt.hashSync(password, 10), superAdmin ? 1 : 0]);
}
async function adminsList() {
  const [rows] = await q("SELECT id, name, username, email, status, super_admin FROM users WHERE role='admin' ORDER BY id DESC"); // newest first
  return rows;
}
async function countAdmins() {
  const [[r]] = await q("SELECT COUNT(*) AS n FROM users WHERE role='admin'");
  return r.n;
}
async function countSuperAdmins() {
  const [[r]] = await q("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND super_admin=1");
  return r.n;
}
async function adminById(id) {
  const [[r]] = await q("SELECT id, super_admin FROM users WHERE id=? AND role='admin'", [id]);
  return r || null;
}
async function deleteAdminUser(id) {
  await q("DELETE FROM sessions WHERE user_id=?", [id]);
  await q("DELETE FROM users WHERE id=? AND role='admin'", [id]);
}

/* ---- student registration numbers ---- */
// Format: <prefix><zero-padded sequence>. The admin sets prefix + width; the
// sequence counter ("next") is managed internally and never reset by the admin,
// so issued numbers stay stable and unique even if the format changes later.
const REGNUM_DEFAULT = { prefix: "", width: 4, next: 1 };
async function getRegConfig() {
  const [[row]] = await q("SELECT v FROM settings WHERE k='regnum'");
  return row ? { ...REGNUM_DEFAULT, ...JSON.parse(row.v) } : { ...REGNUM_DEFAULT };
}
async function getRegConfigForClient() {
  const { prefix, width } = await getRegConfig();
  return { prefix, width };
}
async function setRegConfig(next) {
  const cur = await getRegConfig();
  const merged = {
    prefix: String(next.prefix != null ? next.prefix : cur.prefix).slice(0, 16),
    width: Math.min(12, Math.max(1, Number(next.width) || cur.width || 4)),
    next: cur.next,
  };
  await q("INSERT INTO settings (k,v) VALUES ('regnum',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify(merged)]);
  return { prefix: merged.prefix, width: merged.width };
}
function formatRegNo(cfg, n) { return String(cfg.prefix || "") + String(n).padStart(cfg.width || 4, "0"); }
// Assign the next registration number to a student that has none yet. Returns
// the existing number untouched if one is already set (numbers never change).
async function assignRegNo(userId) {
  const [[u]] = await q("SELECT reg_no FROM users WHERE id=?", [userId]);
  if (!u) return null;
  if (u.reg_no && u.reg_no.trim()) return u.reg_no;
  const cfg = await getRegConfig();
  const n = cfg.next || 1;
  const regNo = formatRegNo(cfg, n);
  await q("UPDATE users SET reg_no=? WHERE id=?", [regNo, userId]);
  await q("INSERT INTO settings (k,v) VALUES ('regnum',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify({ ...cfg, next: n + 1 })]);
  return regNo;
}

/* ---- overdue payment reminders ---- */
// Config holds whether daily reminders are on, plus a secret key the cron URL
// uses to authenticate (so the daily job can run without a logged-in admin).
async function getRemindersConfig() {
  const [[row]] = await q("SELECT v FROM settings WHERE k='reminders'");
  let cfg = row ? JSON.parse(row.v) : { enabled: false, key: "" };
  if (!cfg.key) {
    cfg.key = crypto.randomBytes(18).toString("hex");
    await q("INSERT INTO settings (k,v) VALUES ('reminders',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify(cfg)]);
  }
  return { enabled: !!cfg.enabled, key: cfg.key };
}
async function setRemindersConfig(next) {
  const cur = await getRemindersConfig();
  const merged = { enabled: !!next.enabled, key: cur.key };
  await q("INSERT INTO settings (k,v) VALUES ('reminders',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify(merged)]);
  return merged;
}
async function markReminded(planIds, when) {
  if (!planIds || !planIds.length) return;
  await q(`UPDATE payment_plans SET last_reminded=? WHERE id IN (${planIds.map(() => "?").join(",")})`, [when, ...planIds]);
}

const BRAND_DEFAULT = { company: "", name: "Learning Portal", logo: "", loginIntro: "" };
async function getBrand() {
  const [[row]] = await q("SELECT v FROM settings WHERE k='brand'");
  return row ? { ...BRAND_DEFAULT, ...JSON.parse(row.v) } : { ...BRAND_DEFAULT };
}
// Public showcase for the login page's two floating cards: the newest course
// (title + session count + code) and the total number of recordings. Returns
// null when there are no courses yet, so the login page keeps its defaults.
async function loginShowcase() {
  const [[c]] = await q("SELECT code, title, sessions FROM courses ORDER BY id DESC LIMIT 1");
  if (!c) return null;
  const [[{ recordings }]] = await q("SELECT COUNT(*) AS recordings FROM recordings");
  return {
    course: { code: c.code, title: c.title, sessions: Number(c.sessions) || 0 },
    recordings: Number(recordings) || 0,
  };
}
async function setBrandValue(brand) {
  await q("INSERT INTO settings (k,v) VALUES ('brand',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify(brand)]);
  return brand;
}

// Captcha (bot protection on login + registration). One provider at a time:
// "none", "hcaptcha" or "recaptcha" (Google reCAPTCHA v2). Stored under the
// "captcha" settings key; reads fall back to the legacy "hcaptcha" key so
// sites configured before reCAPTCHA support keep working.
const CAPTCHA_DEFAULT = { provider: "none", siteKey: "", secretKey: "" };
const CAPTCHA_PROVIDERS = ["none", "hcaptcha", "recaptcha"];
async function getCaptcha() {
  const [[row]] = await q("SELECT v FROM settings WHERE k='captcha'");
  if (row) return { ...CAPTCHA_DEFAULT, ...JSON.parse(row.v) };
  const [[legacy]] = await q("SELECT v FROM settings WHERE k='hcaptcha'");
  if (legacy) {
    try {
      const h = JSON.parse(legacy.v);
      return {
        provider: h.enabled && h.siteKey ? "hcaptcha" : "none",
        siteKey: h.siteKey || "",
        secretKey: h.secretKey || "",
      };
    } catch { /* fall through to default */ }
  }
  return { ...CAPTCHA_DEFAULT };
}
async function getCaptchaForClient() {
  const { provider, siteKey, secretKey } = await getCaptcha();
  return { provider, siteKey, hasSecretKey: !!secretKey, enabled: provider !== "none" && !!siteKey };
}
async function setCaptcha(next) {
  const cur = await getCaptcha();
  const provider = CAPTCHA_PROVIDERS.includes(next.provider) ? next.provider : "none";
  const merged = {
    provider,
    siteKey: next.siteKey === undefined ? cur.siteKey : String(next.siteKey),
    secretKey: cur.secretKey,
  };
  if (next.secretKey !== undefined && next.secretKey !== "") merged.secretKey = String(next.secretKey);
  await q("INSERT INTO settings (k,v) VALUES ('captcha',?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [JSON.stringify(merged)]);
  return getCaptchaForClient();
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
  createRequest, studentRequestIds, pendingRequests, getRequest, deleteRequest, clearRequest,
  studentPlans, allPlans, setPlanSchedule, planById, deletePlan, addPayment, paymentOwnerUser, deletePayment, overduePayments,
  getCoursePlan, setCoursePlan,
  setCourseLock, lockedCourseIds, isCourseLocked,
  getRemindersConfig, setRemindersConfig, markReminded,
  addGroup, renameGroup, deleteGroup, reorderGroups, groupExists,
  dumpDatabase, runScript,
  certExists, issueCertificate, listCertificates, getCertificate, studentCertificates, markCertDownloaded, unlockCertificate,
  examsList, examMeta, examFull, addExamQuestion, updateExamQuestion, deleteExamQuestion, clearExamQuestions, deleteExam,
  latestAttempt, createAttempt, finishAttempt, studentExams, studentAttemptsAdmin,
  getBrand, setBrandValue, loginShowcase, getSmtp, getSmtpForClient, setSmtp,
  getRegConfig, getRegConfigForClient, setRegConfig, assignRegNo,
  getCaptcha, getCaptchaForClient, setCaptcha,
  hasAdmin, createAdmin, adminsList, countAdmins, countSuperAdmins, adminById, deleteAdminUser,
  findLoginUser, setResetToken, getResetUser, applyReset,
};
