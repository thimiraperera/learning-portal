import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useStore } from "../state.jsx";
import Captcha from "../components/Captcha.jsx";

const HOME = { admin: "/admin", instructor: "/instructor", student: "/" };

/* Split-screen login. Username + password for both students and admins.
   Styles are scoped here via a <style> tag so they don't leak into the app. */
export default function Login() {
  const { login, brand, captcha: captchaCfg, showcase } = useStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [twoFactor, setTwoFactor] = useState(false); // showing the code step
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);

  useEffect(() => {
    fetch("/api/setup/needed").then((r) => r.json()).then((d) => setSetupNeeded(!!d.needed)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    if (captchaCfg.enabled && !captcha) { setError("Please complete the captcha."); return; }
    setBusy(true);
    const r = await login(username, password, { code: twoFactor ? code : undefined, captcha, remember });
    setBusy(false);
    if (!r.ok) {
      setError(r.error || "Incorrect username or password.");
      if (r.twoFactor) setTwoFactor(true);
      return;
    }
    navigate(HOME[r.role] || "/");
  };

  return (
    <div className="login-page">
      <style>{LOGIN_CSS}</style>

      <div className="login-left">
        <div className="grid-lines" />
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
        <div className="orb orb-4" /><div className="orb orb-5" />

        <div className="float-card float-card-1">
          <div className="fc-label">Course</div>
          <div className="fc-val">{showcase?.course?.title || "Equity Markets"}</div>
          <div className="fc-sub">
            {showcase
              ? [showcase.course.sessions > 0 ? `${showcase.course.sessions} sessions` : null, showcase.course.code].filter(Boolean).join(" · ")
              : "8 sessions · EQ-101"}
          </div>
        </div>
        <div className="float-card float-card-2">
          <div className="fc-label">Progress</div>
          <div className="fc-val">{showcase ? `${showcase.recordings} recording${showcase.recordings === 1 ? "" : "s"}` : "4 recordings"}</div>
          <div className="fc-sub">Available now</div>
        </div>

        <div className="brand-content">
          {brand.logo
            ? <img src={brand.logo} alt={brand.name || "Logo"} className="login-logo" />
            : (
              <>
                {brand.company && <div className="brand-tag">{brand.company}</div>}
                <div className="brand-name">{brand.name || "Learning Portal"}</div>
              </>
            )}
          <div className="brand-divider" />
          {brand.loginIntro
            ? <div className="brand-sub brand-intro" dangerouslySetInnerHTML={{ __html: brand.loginIntro }} />
            : <div className="brand-sub">Your courses, session recordings and materials in one place. All your learning, in one secure portal.</div>}
          <div className="brand-features">
            <div className="brand-feature"><div className="feature-dot" /> Role-based access for students &amp; administrators</div>
            <div className="brand-feature"><div className="feature-dot" /> Recordings, links and downloadable materials</div>
            <div className="brand-feature"><div className="feature-dot" /> Enrolment is the single source of truth</div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-box">
          <div className="login-header">
            <h1>Welcome back</h1>
            <p>Sign in to your account to continue</p>
          </div>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input id="username" type="text" placeholder="Enter your username" autoComplete="username"
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="Enter your password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {twoFactor && (
              <div className="form-group">
                <label htmlFor="code">Authentication code</label>
                <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code"
                  value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
              </div>
            )}
            <div className="login-row">
              <label className="login-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>Remember me for 30 days</span>
              </label>
              <Link to="/forgot" className="login-forgot">Forgot password?</Link>
            </div>
            {captchaCfg.enabled && captchaCfg.siteKey && (
              <div className="form-group"><Captcha provider={captchaCfg.provider} siteKey={captchaCfg.siteKey} onChange={setCaptcha} /></div>
            )}
            <button type="submit" className="btn-login" disabled={busy}>{busy ? "Signing in..." : (twoFactor ? "Verify & sign in" : "Sign In")}</button>
          </form>

          {setupNeeded && (
            <div style={{ marginTop: 18, textAlign: "center", fontSize: 13.5 }}>
              No administrator yet? <Link to="/setup" style={{ color: "#1E509B", fontWeight: 700 }}>Create the first admin</Link>
            </div>
          )}

          <div className="login-footer">
            {[brand.company, brand.name || "Learning Portal"].filter(Boolean).join("  ·  ")}
          </div>
        </div>
      </div>
    </div>
  );
}

const LOGIN_CSS = `
.login-page { min-height: 100vh; display: flex; background: #F0F4FB; }
.login-left {
  width: 50%;
  background: linear-gradient(145deg, #001A4D 0%, #1E509B 60%, #2563EB 100%);
  display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
  padding: 64px; position: relative; overflow: hidden;
}
.orb { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.06); animation: float 8s ease-in-out infinite; }
.orb-1 { width:320px; height:320px; top:-80px; right:-80px; animation-duration:9s; }
.orb-2 { width:200px; height:200px; bottom:-60px; left:-60px; animation-delay:2s; animation-duration:7s; }
.orb-3 { width:140px; height:140px; top:50%; right:60px; animation-delay:4s; animation-duration:11s; }
.orb-4 { width:80px; height:80px; top:30%; left:40px; animation-delay:1.5s; animation-duration:6s; }
.orb-5 { width:60px; height:60px; bottom:25%; right:20%; animation-delay:3s; animation-duration:8s; }
@keyframes float { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-20px) scale(1.05); } }
.grid-lines {
  position: absolute; inset: 0; opacity: 0.05;
  background-image: linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px);
  background-size: 40px 40px; animation: gridMove 20s linear infinite;
}
@keyframes gridMove { 0% { background-position: 0 0; } 100% { background-position: 40px 40px; } }
.float-card {
  position: absolute; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px; padding: 12px 16px; backdrop-filter: blur(4px); animation: floatCard 10s ease-in-out infinite;
}
.float-card-1 { top:18%; right:8%; }
.float-card-2 { bottom:22%; right:12%; animation-delay:3s; }
@keyframes floatCard { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-12px) rotate(1deg); } }
.fc-label { font-size:9px; font-weight:700; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px; }
.fc-val { font-size:15px; font-weight:800; color:white; margin-top:3px; }
.fc-sub { font-size:10px; color:rgba(255,255,255,0.5); margin-top:2px; }
.brand-content { position: relative; z-index: 2; }
.brand-tag { font-size:10px; font-weight:700; letter-spacing:2.5px; color:rgba(255,255,255,0.45); text-transform:uppercase; margin-bottom:20px; display:flex; align-items:center; gap:8px; }
.brand-tag::before { content:''; width:20px; height:2px; background:rgba(255,255,255,0.3); border-radius:2px; }
.brand-name { font-size:42px; font-weight:800; color:white; line-height:1.1; margin-bottom:16px; letter-spacing:-1px; }
.login-logo { max-height:72px; max-width:280px; object-fit:contain; display:block; margin-bottom:8px; }
.brand-divider { width:48px; height:4px; border-radius:2px; background:linear-gradient(90deg,rgba(255,255,255,0.6),rgba(255,255,255,0.1)); margin:20px 0 22px; }
.brand-sub { font-size:15px; color:rgba(255,255,255,0.6); font-weight:400; line-height:1.7; max-width:360px; }
.brand-intro p { margin:0 0 8px; }
.brand-intro p:last-child { margin-bottom:0; }
.brand-intro ul, .brand-intro ol { margin:8px 0; padding-left:20px; }
.brand-intro a { color:#fff; text-decoration:underline; }
.brand-intro strong, .brand-intro b { color:rgba(255,255,255,0.9); font-weight:700; }
.brand-features { display:flex; flex-direction:column; gap:10px; margin-top:28px; }
.brand-feature { display:flex; align-items:center; gap:10px; color:rgba(255,255,255,0.7); font-size:13.5px; font-weight:500; }
.feature-dot { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.5); flex-shrink:0; }
.login-right { width: 50%; display: flex; align-items: center; justify-content: center; padding: 48px; }
.login-box { width: 100%; max-width: 420px; }
.login-header { margin-bottom: 30px; }
.login-header h1 { font-size: 30px; font-weight: 800; color: #121212; margin-bottom: 8px; }
.login-header p { font-size: 14.5px; color: #888; }
.login-box label { display:block; font-size:13px; font-weight:600; color:#3D3D3D; margin-bottom:8px; }
.login-box input[type="text"], .login-box input[type="password"] {
  width:100%; padding:13px 16px; border:1.5px solid #D8E2F0; border-radius:10px;
  font-family:'Figtree',sans-serif; font-size:15px; color:#121212; background:white;
  transition:border-color 0.2s, box-shadow 0.2s; outline:none;
}
.login-box input:focus { border-color:#1E509B; box-shadow:0 0 0 3px rgba(30,80,155,0.1); }
.btn-login {
  width:100%; padding:14px; background:linear-gradient(135deg,#1E509B,#00265E);
  color:white; border:none; border-radius:999px; font-family:'Figtree',sans-serif;
  font-size:16px; font-weight:700; cursor:pointer; transition:opacity 0.2s, transform 0.15s; margin-top: 4px;
}
.btn-login:hover { opacity:0.92; transform:translateY(-1px); }
.error-box { background:#FEE2E2; border-left:4px solid #DC2626; border-radius:8px; padding:12px 16px; margin-bottom:20px; font-size:14px; color:#991B1B; font-weight:500; }
.login-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:4px 0 18px; flex-wrap:wrap; }
.login-remember { display:inline-flex; align-items:center; gap:8px; font-size:13px; line-height:1; color:#3D3D3D; font-weight:500; cursor:pointer; margin:0; }
.login-remember input { width:16px; height:16px; margin:0; flex-shrink:0; accent-color:#1E509B; cursor:pointer; }
.login-remember span { line-height:1; }
.login-forgot { font-size:13px; color:#1E509B; font-weight:700; text-decoration:none; }
.login-forgot:hover { text-decoration:underline; }
.login-footer { margin-top:28px; text-align:center; font-size:12px; color:#aaa; }
@media (max-width:768px) { .login-left { display:none; } .login-right { width:100%; padding:32px 24px; } }
`;
