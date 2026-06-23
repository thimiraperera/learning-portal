import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../state.jsx";
import Button from "../components/Button.jsx";

/* Public "forgot password" page. Sends a reset link when the account has an
   email on file; otherwise tells the user to contact their administrator. */
export default function Forgot() {
  const { brand, requestPasswordReset } = useStore();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { tone, text }
  const [error, setError] = useState("");

  const MESSAGES = {
    sent: { tone: "ok", text: "If an account with that username or email exists and has an email on file, we've sent a password reset link. Please check your inbox (and spam folder)." },
    noemail: { tone: "warn", text: "This account has no email address on file, so we can't send a reset link. Please contact your administrator to reset your password." },
    nomail_config: { tone: "warn", text: "We couldn't send the email right now. Please contact your administrator to reset your password." },
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!username.trim()) { setError("Enter your username or email."); return; }
    setBusy(true);
    const r = await requestPasswordReset(username.trim());
    setBusy(false);
    if (!r.ok) { setError(r.error || "Something went wrong."); return; }
    setResult(MESSAGES[r.state] || MESSAGES.sent);
  };

  return (
    <div className="register-page">
      <style>{REG_CSS}</style>
      <div className="reg-card">
        <div className="reg-brand">{brand.name || "Learning Portal"}</div>
        <h1>Forgot password</h1>
        <p className="reg-muted">Enter your username or email and we'll send you a link to reset your password.</p>

        {error && <div className="reg-error">{error}</div>}
        {result && <div className={result.tone === "ok" ? "reg-ok" : "reg-warn"}>{result.text}</div>}

        {!result && (
          <form onSubmit={submit}>
            <label>Username or email</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username or email" autoFocus />
            <Button type="submit" className="reg-btn" loading={busy}>Send reset link</Button>
          </form>
        )}

        <p className="reg-muted" style={{ marginTop: 20, textAlign: "center" }}>
          <Link to="/login" style={{ color: "#1E509B", fontWeight: 700 }}>Back to sign in</Link>
        </p>
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
.reg-ok { background: #F0FDF4; border-left: 4px solid #16A34A; color: #065F46; border-radius: 8px; padding: 12px 14px; font-size: 13.5px; line-height: 1.5; margin: 16px 0 0; }
.reg-warn { background: #FFFBEB; border-left: 4px solid #D97706; color: #92400E; border-radius: 8px; padding: 12px 14px; font-size: 13.5px; line-height: 1.5; margin: 16px 0 0; }
.reg-card form { margin-top: 14px; }
.reg-card label { display: block; font-size: 12.5px; font-weight: 600; color: #3D3D3D; margin: 14px 0 6px; }
.reg-card input { width: 100%; padding: 12px 14px; border: 1.5px solid #D8E2F0; border-radius: 10px; font-family: 'Figtree', sans-serif; font-size: 14.5px; color: #121212; outline: none; background: white; }
.reg-card input:focus { border-color: #1E509B; box-shadow: 0 0 0 3px rgba(30,80,155,0.1); }
.reg-btn { width: 100%; margin-top: 22px; padding: 13px; background: linear-gradient(135deg,#1E509B,#00265E); color: #fff; border: none; border-radius: 999px; font-family: 'Figtree', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; }
.reg-btn:hover { opacity: 0.93; }
.reg-btn:disabled { opacity: 0.6; cursor: default; }
`;
