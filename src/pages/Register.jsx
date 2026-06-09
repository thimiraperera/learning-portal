import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../state.jsx";

/* Public registration page reached from the invite email link
   (/register?token=...). Email and username are locked; the user confirms
   their full name (used on certificates) and sets a password. */
export default function Register() {
  const { brand } = useStore();
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token");

  const [state, setState] = useState("loading"); // loading | ready | invalid | done
  const [invite, setInvite] = useState(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/api/register/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => { setInvite(data); setName(data.name || ""); setState("ready"); })
      .catch(() => setState("invalid"));
  }, [token]);

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!name.trim()) { setError("Please confirm your full name."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/register/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Registration failed.");
      setState("done");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="register-page">
      <style>{REG_CSS}</style>
      <div className="reg-card">
        <div className="reg-brand">{brand.name || "Learning Portal"}</div>

        {state === "loading" && <p className="reg-muted">Checking your invitation...</p>}

        {state === "invalid" && (
          <>
            <h1>Link not valid</h1>
            <p className="reg-muted">This registration link is invalid or has already been used. Please contact your administrator.</p>
          </>
        )}

        {state === "done" && (
          <>
            <h1>You're all set</h1>
            <p className="reg-muted">Your account is ready. Redirecting you to sign in...</p>
          </>
        )}

        {state === "ready" && (
          <>
            <h1>Complete your registration</h1>
            <p className="reg-muted">Confirm your details and set a password to activate your account.</p>

            <div className="reg-notice">
              Please check your details carefully. Your <strong>full name</strong> is used exactly as shown on your course certificates.
            </div>

            {error && <div className="reg-error">{error}</div>}

            <form onSubmit={submit}>
              <label>Full name <span className="reg-hint">(used on certificates)</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />

              <label>Email <span className="reg-hint">(cannot be changed)</span></label>
              <input type="text" value={invite.email} readOnly disabled />

              <label>Username <span className="reg-hint">(cannot be changed)</span></label>
              <input type="text" value={invite.username} readOnly disabled />

              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />

              <label>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />

              <button type="submit" className="reg-btn" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
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
.reg-notice { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.5; margin: 18px 0 4px; }
.reg-error { background: #FEE2E2; border-left: 4px solid #DC2626; color: #991B1B; border-radius: 8px; padding: 11px 14px; font-size: 13.5px; margin: 16px 0 0; }
.reg-card form { margin-top: 14px; }
.reg-card label { display: block; font-size: 12.5px; font-weight: 600; color: #3D3D3D; margin: 14px 0 6px; }
.reg-hint { color: #9CA3AF; font-weight: 400; }
.reg-card input { width: 100%; padding: 12px 14px; border: 1.5px solid #D8E2F0; border-radius: 10px; font-family: 'Figtree', sans-serif; font-size: 14.5px; color: #121212; outline: none; }
.reg-card input:focus { border-color: #1E509B; box-shadow: 0 0 0 3px rgba(30,80,155,0.1); }
.reg-card input:disabled { background: #F4F7FB; color: #9CA3AF; cursor: not-allowed; }
.reg-btn { width: 100%; margin-top: 22px; padding: 13px; background: linear-gradient(135deg,#1E509B,#00265E); color: #fff; border: none; border-radius: 999px; font-family: 'Figtree', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; }
.reg-btn:hover { opacity: 0.93; }
.reg-btn:disabled { opacity: 0.6; cursor: default; }
`;
