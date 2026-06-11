/* Create (or reset) the administrator from the .env file.
   Run from the app root:  node create-admin.cjs
   Reads DB_* and ADMIN_* from .env (same file the app uses). Safe to run any
   time: if the admin username already exists it just resets its password and
   makes sure it is an active admin; otherwise it creates it. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const bcrypt = require("bcryptjs");
const dbmod = require("./db.cjs");

(async () => {
  try {
    await dbmod.init(); // make sure the schema exists

    const username = String(process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
    const email = String(process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
    const password = String(process.env.ADMIN_PASSWORD || "admin123");
    const name = String(process.env.ADMIN_NAME || "Administrator");
    const hash = bcrypt.hashSync(password, 10);

    const [[existing]] = await dbmod.q("SELECT id FROM users WHERE lower(username)=?", [username]);
    if (existing) {
      await dbmod.q("UPDATE users SET password_hash=?, email=?, name=?, role='admin', status='active' WHERE id=?",
        [hash, email, name, existing.id]);
      console.log(`Updated admin '${username}' (password reset from .env).`);
    } else {
      await dbmod.q(
        "INSERT INTO users (name,first_name,last_name,nickname,username,email,password_hash,role,status) VALUES (?,?,?, '', ?,?,?, 'admin','active')",
        [name, name.split(" ")[0] || name, name.split(" ").slice(1).join(" "), username, email, hash]);
      console.log(`Created admin '${username}'.`);
    }
    console.log(`You can now log in with username '${username}' and the ADMIN_PASSWORD from your .env.`);
  } catch (e) {
    console.error("Failed:", e.message);
    process.exitCode = 1;
  } finally {
    try { await dbmod.pool.end(); } catch { /* ignore */ }
  }
})();
