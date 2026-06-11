import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useStore } from "../state.jsx";

/* Public first-run page: create the very first administrator. The server only
   allows this while no admin account exists, so it is safe to leave routed. */
export default function Setup() {
  const { brand } = useStore();
  const navigate = useNavigate();
  const [state, setState] = useState("loading"); // loading | ready | exists | done
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/setup/needed")
      .then((r) => r.json())
      .then((d) => setState(d.needed ? "ready" : "exists"))
      .catch(() => setState("ready"));
  }, []);

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!name.trim()) { setError("Enter a full name."); return; }
    if (!username.trim()) { setError("Enter a username."); return; }
    if (!email.includes("@")) { setError("Enter a valid email."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/setup/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), username: username.trim(), email: email.trim(), password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Could not create the administrator.");
      setState("done");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="register-page">
      <style>{REG_CSS}</style>
      <div className="reg-card">
        <div className="reg-brand">{brand.name || "Learning Portal"}</div>

        {state === "loading" && <p className="reg-muted">Checking setup...</p>}

        {state === "exists" && (
          <>
            <h1>Already set up</h1>
            <p className="reg-muted">An administrator account already exists. <Link to="/login" style={{ color: "#1E509B", fontWeight: 700 }}>Go to sign in</Link>.</p>
          </>
        )}

        {state === "done" && (
          <>
            <h1>Administrator created</h1>
            <p className="reg-muted">Your admin account is ready. Redirecting you to sign in...</p>
          </>
        )}

        {state === "ready" && (
          <>
            <h1>Create administrator</h1>
            <p className="reg-muted">No admin account exists yet. Create the first one to manage the portal.</p>
            {error && <div className="reg-error">{error}</div>}
            <form onSubmit={submit}>
              <label>Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              <label>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username to sign in with" autoComplete="username" />
              <label>Email</label>
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              <label>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />
              <button type="submit" className="reg-btn" disabled={busy}>{busy ? "Creating..." : "Create administrator"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const REG_CSS = `
.register-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
  background: linear-gradient(145deg, #001A4D 0%, #1E509B 60%, #2563EB 100%); }
.reg-card { width: 100%; max-width: 440px; background: #fff; border-radius: 16px; padding: 34px; box-shadow: 0 24px 60px rgba(0,0,0,0.3); }
.reg-brand { font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #1E509B; margin-bottom: 18px; }
.reg-card h1 { font-size: 24px; font-weight: 800; color: #121212; margin-bottom: 6px; }
.reg-muted { font-size: 14px; color: #6B7280; line-height: 1.5; }
.reg-error { background: #FEE2E2; border-left: 4px solid #DC2626; color: #991B1B; border-radius: 8px; padding: 11px 14px; font-size: 13.5px; margin: 16px 0 0; }
.reg-card form { margin-top: 14px; }
.reg-card label { display: block; font-size: 12.5px; font-weight: 600; color: #3D3D3D; margin: 14px 0 6px; }
.reg-card input { width: 100%; padding: 12px 14px; border: 1.5px solid #D8E2F0; border-radius: 10px; font-family: 'Figtree', sans-serif; font-size: 14.5px; color: #121212; outline: none; background: white; }
.reg-card input:focus { border-color: #1E509B; box-shadow: 0 0 0 3px rgba(30,80,155,0.1); }
.reg-btn { width: 100%; margin-top: 22px; padding: 13px; background: linear-gradient(135deg,#1E509B,#00265E); color: #fff; border: none; border-radius: 999px; font-family: 'Figtree', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; }
.reg-btn:hover { opacity: 0.93; }
.reg-btn:disabled { opacity: 0.6; cursor: default; }
`;
