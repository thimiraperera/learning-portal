/* ------------------------------------------------------------------
   Seed data. In production this lives in a database with row-level
   security so a student can only ever read their enrolled courses.
   ------------------------------------------------------------------ */

export const seedCourses = {
  c1: {
    title: "Foundations of Equity Markets",
    code: "EQ-101",
    instructor: "C. Hettiarachchi",
    blurb: "How exchanges, orders and price discovery actually work.",
    sessions: 8,
    recordings: [
      { t: "Market structure & order types", d: "May 04, 2026", len: "1h 12m" },
      { t: "Reading a quote: bid, ask, spread", d: "May 11, 2026", len: "58m" },
      { t: "Primary vs secondary markets", d: "May 18, 2026", len: "1h 04m" },
      { t: "Settlement, custody & the CDS", d: "May 25, 2026", len: "47m" },
    ],
    links: [
      { t: "Colombo Stock Exchange (live board)", u: "https://www.cse.lk" },
      { t: "Glossary: 40 terms every beginner needs", u: "#" },
    ],
    materials: [
      { t: "Session 1-2 slide deck", size: "4.2 MB", ext: "PDF" },
      { t: "Order-types cheat sheet", size: "180 KB", ext: "PDF" },
    ],
  },
  c2: {
    title: "Technical Analysis Masterclass",
    code: "TA-220",
    instructor: "C. Hettiarachchi",
    blurb: "Price action, structure and the discipline behind the charts.",
    sessions: 10,
    recordings: [
      { t: "Support, resistance & market memory", d: "May 06, 2026", len: "1h 21m" },
      { t: "Trend, range and the in-between", d: "May 13, 2026", len: "1h 09m" },
      { t: "Volume as confirmation", d: "May 20, 2026", len: "55m" },
    ],
    links: [
      { t: "Charting workspace template", u: "#" },
      { t: "Pattern reference library", u: "#" },
    ],
    materials: [
      { t: "TA pattern handbook", size: "9.8 MB", ext: "PDF" },
      { t: "Trade journal template", size: "320 KB", ext: "XLSX" },
    ],
  },
  c3: {
    title: "Options & Derivatives",
    code: "DV-310",
    instructor: "C. Hettiarachchi",
    blurb: "Payoffs, greeks and structuring positions with intent.",
    sessions: 9,
    recordings: [
      { t: "Calls, puts & the payoff diagram", d: "May 09, 2026", len: "1h 30m" },
      { t: "The greeks, plainly", d: "May 16, 2026", len: "1h 18m" },
    ],
    links: [{ t: "Options payoff simulator", u: "#" }],
    materials: [{ t: "Greeks quick-reference", size: "640 KB", ext: "PDF" }],
  },
  c4: {
    title: "Portfolio Construction & Risk",
    code: "PF-330",
    instructor: "C. Hettiarachchi",
    blurb: "Sizing, diversification and surviving your worst week.",
    sessions: 7,
    recordings: [{ t: "Position sizing & the 2% rule", d: "May 12, 2026", len: "1h 02m" }],
    links: [{ t: "Risk calculator spreadsheet", u: "#" }],
    materials: [{ t: "Allocation worksheet", size: "210 KB", ext: "XLSX" }],
  },
};

// Enrolments are the access-control table. UI filtering is for show only;
// the real boundary must be enforced server-side / in the database.
// Passwords are plain text here only because this is a front-end prototype.
export const seedUsers = {
  "chamira@demo.lk": { name: "Chamira H.", username: "admin", password: "admin123", role: "admin", enrolled: [], status: "active" },
  "ravi@demo.lk":    { name: "Ravi Perera", username: "ravi", password: "ravi123", role: "student", enrolled: ["c1", "c2"], status: "active" },
  "amara@demo.lk":   { name: "Amara Silva", username: "amara", password: "amara123", role: "student", enrolled: ["c2", "c3", "c4"], status: "active" },
  "dilan@demo.lk":   { name: "Dilan Fernando", username: "dilan", password: "dilan123", role: "student", enrolled: [], status: "active" },
};
