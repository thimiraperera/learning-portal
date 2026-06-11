/* CLI sample-data loader (TEMPORARY, for testing).
   Run:  node seed.cjs
   Wipes all data + inserts demo students/instructors/courses/exams and a
   fresh admin (admin / admin123). Useful when the in-app button can't reach a
   freshly-changed server. Remove this file for production. */
const dbmod = require("./db.cjs");

(async () => {
  try {
    await dbmod.init();
    const counts = await dbmod.seedBulk();
    console.log("Sample data loaded:", counts);
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    try { await dbmod.pool.end(); } catch { /* ignore */ }
  }
})();
