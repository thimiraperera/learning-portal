import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../state.jsx";
import PhoneInput from "../components/PhoneInput.jsx";
import Captcha from "../components/Captcha.jsx";
import Button from "../components/Button.jsx";

/* Public sign-up page behind the one shareable /join link an admin hands out.
   Nobody is invited here, so unlike the invite page this one also collects the
   email and cannot offer a live username check. */
export default function Join() {
  const { brand, checkSelfRegister, selfRegister, captcha: captchaCfg } = useStore();
  const navigate = useNavigate();

  const [state, setState] = useState("loading"); // loading | ready | invalid | done
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [uname, setUname] = useState({ status: "idle", msg: "" }); // idle | invalid
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    checkSelfRegister().then((r) => {
      if (!alive) return;
      setState(r.ok ? "ready" : "invalid");
    });
    return () => { alive = false; };
  }, [checkSelfRegister]);

  // Sanitize as the user types: lowercase, only a-z 0-9 and hyphens.
  const onUsername = (v) => setUsername(v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24));

  // No availability endpoint on this route. Length is checked here, and a
  // duplicate comes back on submit.
  useEffect(() => {
    const u = username.trim();
    if (u && u.length < 3) setUname({ status: "invalid", msg: "Use at least 3 characters." });
    else setUname({ status: "idle", msg: "" });
  }, [username]);

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email."); return; }
    if (!firstName.trim()) { setError("Enter your first name."); return; }
    if (!lastName.trim()) { setError("Enter your last name."); return; }
    if (!name.trim()) { setError("Confirm your full name (used on certificates)."); return; }
    if (!phone.trim()) { setError("Enter your phone number."); return; }
    if (!gender) { setError("Select your gender."); return; }
    if (username.trim().length < 3) { setError("Choose a username of at least 3 characters."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (captchaCfg.enabled && !captcha) { setError("Please complete the captcha."); return; }
    setBusy(true);
    const r = await selfRegister({
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: name.trim(),
      username: username.trim(),
      phone: phone.trim(),
      gender,
      password,
      captcha,
    });
    setBusy(false);
    if (!r.ok) { setError(r.error || "Registration failed."); return; }
    setState("done");
    setTimeout(() => navigate("/login"), 1800);
  };

  return (
    <div className="register-page">
      <style>{JOIN_CSS}</style>
      <div className="reg-card">
        <div className="reg-brand">{brand.name || "Learning Portal"}</div>

        {state === "loading" && <p className="reg-muted">Checking your registration link...</p>}

        {state === "invalid" && (
          <>
            <h1>Link not valid</h1>
            <p className="reg-muted">This registration link is not valid. Please ask your administrator for a new one.</p>
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
            <h1>Create your account</h1>
            <p className="reg-muted">Fill in your details and set a password to activate your account.</p>

            <div className="reg-notice">
              Please check your details carefully. Your <strong>full name</strong> is used exactly as shown on your course certificates.
            </div>

            {error && <div className="reg-error">{error}</div>}

            <form onSubmit={submit}>
              <div className="reg-row">
                <div>
                  <label>First name <span className="req">*</span></label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name" />
                </div>
                <div>
                  <label>Last name <span className="req">*</span></label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" autoComplete="family-name" />
                </div>
              </div>

              <label>Full name <span className="req">*</span> <span className="reg-hint">(used on certificates)</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" />

              <label>Phone <span className="req">*</span></label>
              <PhoneInput value={phone} onChange={setPhone} />

              <label>Gender <span className="req">*</span></label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>

              <label>Email <span className="req">*</span></label>
              <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />

              {/* autoComplete="username" so the browser saves THIS as the login
                  name, not the phone or the email. */}
              <label>Username <span className="req">*</span> <span className="reg-hint">(this is what you sign in with)</span></label>
              <input type="text" name="username" value={username} onChange={(e) => onUsername(e.target.value)} autoComplete="username" placeholder="Choose a username" />
              <div className={"uname-hint uname-" + uname.status}>{uname.msg}</div>

              <label>Password <span className="req">*</span></label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />

              <label>Confirm password <span className="req">*</span></label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />

              {captchaCfg.enabled && captchaCfg.siteKey && (
                <div style={{ marginTop: 14 }}><Captcha provider={captchaCfg.provider} siteKey={captchaCfg.siteKey} onChange={setCaptcha} /></div>
              )}

              <Button type="submit" className="reg-btn" loading={busy}>Create account</Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* Same selectors as the invite page so both registration screens look identical.
   Only one of them is ever mounted, so the duplicate rules never collide. */
const JOIN_CSS = `
.register-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
  background: linear-gradient(145deg, #001A4D 0%, #1E509B 60%, #2563EB 100%); }
.reg-card { width: 100%; max-width: 560px; background: #fff; border-radius: 16px; padding: 34px; box-shadow: 0 24px 60px rgba(0,0,0,0.3); }
.reg-brand { font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #1E509B; margin-bottom: 18px; }
.reg-card h1 { font-size: 24px; font-weight: 800; color: #121212; margin-bottom: 6px; }
.reg-muted { font-size: 14px; color: #6B7280; line-height: 1.5; }
.reg-notice { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.5; margin: 18px 0 4px; }
.reg-error { background: #FEE2E2; border-left: 4px solid #DC2626; color: #991B1B; border-radius: 8px; padding: 11px 14px; font-size: 13.5px; margin: 16px 0 0; }
.reg-card form { margin-top: 14px; }
.reg-card label { display: block; font-size: 12.5px; font-weight: 600; color: #3D3D3D; margin: 14px 0 6px; }
.reg-hint { color: #9CA3AF; font-weight: 400; }
.reg-card input, .reg-card select { width: 100%; padding: 12px 14px; border: 1.5px solid #D8E2F0; border-radius: 10px; font-family: 'Figtree', sans-serif; font-size: 14.5px; color: #121212; outline: none; background: white; }
.reg-card input:focus, .reg-card select:focus { border-color: #1E509B; box-shadow: 0 0 0 3px rgba(30,80,155,0.1); }
.reg-card input:disabled, .reg-card input.locked { background: #F4F7FB; color: #9CA3AF; cursor: not-allowed; }
.reg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.uname-hint { font-size: 12px; font-weight: 600; margin-top: 6px; min-height: 16px; }
.uname-invalid { color: #DC2626; }
.uname-idle { color: transparent; }
.reg-btn { width: 100%; margin-top: 22px; padding: 13px; background: linear-gradient(135deg,#1E509B,#00265E); color: #fff; border: none; border-radius: 999px; font-family: 'Figtree', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; }
.reg-btn:hover { opacity: 0.93; }
.reg-btn:disabled { opacity: 0.6; cursor: default; }
`;
