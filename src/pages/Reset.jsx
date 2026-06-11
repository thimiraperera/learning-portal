import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useStore } from "../state.jsx";

/* Public password-reset page reached from the emailed link (/reset?token=...). */
export default function Reset() {
  const { brand, resetPassword } = useStore();
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token");

  const [state, setState] = useState("loading"); // loading | ready | invalid | done
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/api/reset/${token}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(() => setState("ready"))
      .catch(() => setState("invalid"));
  }, [token]);

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    const r = await resetPassword(token, password);
    setBusy(false);
    if (!r.ok) { setError(r.error || "Could not reset your password."); return; }
    setState("done");
    setTimeout(() => navigate("/login"), 1800);
  };

  return (
    <div className="register-page">
      <style>{REG_CSS}</style>
      <div className="reg-card">
        <div className="reg-brand">{brand.name || "Learning Portal"}</div>

        {state === "loading" && <p className="reg-muted">Checking your link...</p>}

        {state === "invalid" && (
          <>
            <h1>Link not valid</h1>
            <p className="reg-muted">This reset link is invalid or has expired. <Link to="/forgot" style={{ color: "#1E509B", fontWeight: 700 }}>Request a new one</Link>.</p>
          </>
        )}

        {state === "done" && (
          <>
            <h1>Password updated</h1>
            <p className="reg-muted">Your password has been changed. Redirecting you to sign in...</p>
          </>
        )}

        {state === "ready" && (
          <>
            <h1>Set a new password</h1>
            <p className="reg-muted">Choose a new password for your account.</p>
            {error && <div className="reg-error">{error}</div>}
            <form onSubmit={submit}>
              <label>New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              <label>Confirm new password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />
              <button type="submit" className="reg-btn" disabled={busy}>{busy ? "Updating..." : "Update password"}</button>
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
