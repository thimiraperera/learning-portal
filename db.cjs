/* SQLite data layer for the Learning Portal.
   Creates the schema on first run and seeds demo data with hashed passwords.
   The database file (data.sqlite) lives next to this file and persists on
   the server across deploys (it is gitignored, so git pull never touches it). */
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const db = new Database(path.join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student',
  status        TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS courses (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  title      TEXT NOT NULL,
  instructor TEXT,
  blurb      TEXT,
  sessions   INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS recordings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, course_id TEXT NOT NULL, title TEXT NOT NULL, date TEXT, length TEXT
);
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT, course_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT
);
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT, course_id TEXT NOT NULL, title TEXT NOT NULL, size TEXT, ext TEXT
);
CREATE TABLE IF NOT EXISTS enrolments (
  user_id INTEGER NOT NULL, course_id TEXT NOT NULL, PRIMARY KEY (user_id, course_id)
);
CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT );
`);

/* ---- one-time seed ---- */
function seedIfEmpty() {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  if (n > 0) return;

  const insUser = db.prepare("INSERT INTO users (name,username,email,password_hash,role,status) VALUES (?,?,?,?,?,'active')");
  const mk = (name, username, email, pw, role) => insUser.run(name, username, email, bcrypt.hashSync(pw, 10), role).lastInsertRowid;
  mk("Chamira H.", "admin", "chamira@demo.lk", "admin123", "admin");
  const ravi  = mk("Ravi Perera", "ravi", "ravi@demo.lk", "ravi123", "student");
  const amara = mk("Amara Silva", "amara", "amara@demo.lk", "amara123", "student");
  mk("Dilan Fernando", "dilan", "dilan@demo.lk", "dilan123", "student");

  const insCourse = db.prepare("INSERT INTO courses (id,code,title,instructor,blurb,sessions) VALUES (?,?,?,?,?,?)");
  const insRec = db.prepare("INSERT INTO recordings (course_id,title,date,length) VALUES (?,?,?,?)");
  const insLink = db.prepare("INSERT INTO links (course_id,title,url) VALUES (?,?,?)");
  const insMat = db.prepare("INSERT INTO materials (course_id,title,size,ext) VALUES (?,?,?,?)");

  insCourse.run("c1", "EQ-101", "Foundations of Equity Markets", "C. Hettiarachchi", "How exchanges, orders and price discovery actually work.", 8);
  insRec.run("c1", "Market structure & order types", "May 04, 2026", "1h 12m");
  insRec.run("c1", "Reading a quote: bid, ask, spread", "May 11, 2026", "58m");
  insRec.run("c1", "Primary vs secondary markets", "May 18, 2026", "1h 04m");
  insRec.run("c1", "Settlement, custody & the CDS", "May 25, 2026", "47m");
  insLink.run("c1", "Colombo Stock Exchange (live board)", "https://www.cse.lk");
  insLink.run("c1", "Glossary: 40 terms every beginner needs", "#");
  insMat.run("c1", "Session 1-2 slide deck", "4.2 MB", "PDF");
  insMat.run("c1", "Order-types cheat sheet", "180 KB", "PDF");

  insCourse.run("c2", "TA-220", "Technical Analysis Masterclass", "C. Hettiarachchi", "Price action, structure and the discipline behind the charts.", 10);
  insRec.run("c2", "Support, resistance & market memory", "May 06, 2026", "1h 21m");
  insRec.run("c2", "Trend, range and the in-between", "May 13, 2026", "1h 09m");
  insRec.run("c2", "Volume as confirmation", "May 20, 2026", "55m");
  insLink.run("c2", "Charting workspace template", "#");
  insLink.run("c2", "Pattern reference library", "#");
  insMat.run("c2", "TA pattern handbook", "9.8 MB", "PDF");
  insMat.run("c2", "Trade journal template", "320 KB", "XLSX");

  insCourse.run("c3", "DV-310", "Options & Derivatives", "C. Hettiarachchi", "Payoffs, greeks and structuring positions with intent.", 9);
  insRec.run("c3", "Calls, puts & the payoff diagram", "May 09, 2026", "1h 30m");
  insRec.run("c3", "The greeks, plainly", "May 16, 2026", "1h 18m");
  insLink.run("c3", "Options payoff simulator", "#");
  insMat.run("c3", "Greeks quick-reference", "640 KB", "PDF");

  insCourse.run("c4", "PF-330", "Portfolio Construction & Risk", "C. Hettiarachchi", "Sizing, diversification and surviving your worst week.", 7);
  insRec.run("c4", "Position sizing & the 2% rule", "May 12, 2026", "1h 02m");
  insLink.run("c4", "Risk calculator spreadsheet", "#");
  insMat.run("c4", "Allocation worksheet", "210 KB", "XLSX");

  const insEnrol = db.prepare("INSERT INTO enrolments (user_id,course_id) VALUES (?,?)");
  insEnrol.run(ravi, "c1"); insEnrol.run(ravi, "c2");
  insEnrol.run(amara, "c2"); insEnrol.run(amara, "c3"); insEnrol.run(amara, "c4");

  db.prepare("INSERT INTO settings (key,value) VALUES ('brand',?)")
    .run(JSON.stringify({ company: "", name: "Learning Portal", logo: "" }));
}
seedIfEmpty();

/* ---- read helpers (assemble the shapes the frontend expects) ---- */
function courseFull(id) {
  const c = db.prepare("SELECT * FROM courses WHERE id=?").get(id);
  if (!c) return null;
  return {
    code: c.code, title: c.title, instructor: c.instructor, blurb: c.blurb, sessions: c.sessions,
    recordings: db.prepare("SELECT id, title AS t, date AS d, length AS len FROM recordings WHERE course_id=? ORDER BY id").all(id),
    links:      db.prepare("SELECT id, title AS t, url AS u FROM links WHERE course_id=? ORDER BY id").all(id),
    materials:  db.prepare("SELECT id, title AS t, size, ext FROM materials WHERE course_id=? ORDER BY id").all(id),
  };
}
function coursesMap(ids) {
  const rows = db.prepare("SELECT id FROM courses ORDER BY rowid").all();
  const map = {};
  for (const { id } of rows) if (!ids || ids.includes(id)) map[id] = courseFull(id);
  return map;
}
function enrolledIds(userId) {
  return db.prepare("SELECT course_id FROM enrolments WHERE user_id=?").all(userId).map((r) => r.course_id);
}
function lockedCourses(ids) {
  return db.prepare("SELECT id, title FROM courses ORDER BY rowid").all().filter((c) => !ids.includes(c.id));
}
function usersMap() {
  const rows = db.prepare("SELECT * FROM users WHERE role='student' ORDER BY id").all();
  const map = {};
  for (const u of rows) map[u.email] = { id: u.id, name: u.name, username: u.username, role: u.role, status: u.status, enrolled: enrolledIds(u.id) };
  return map;
}
function getBrand() {
  const row = db.prepare("SELECT value FROM settings WHERE key='brand'").get();
  return row ? JSON.parse(row.value) : { company: "", name: "Learning Portal", logo: "" };
}

module.exports = { db, courseFull, coursesMap, enrolledIds, lockedCourses, usersMap, getBrand };
