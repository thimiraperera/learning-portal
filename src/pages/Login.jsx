import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../state.jsx";

/* Split-screen login ported from invoice-workflow login.html.
   Styles are scoped here via a <style> tag so they don't leak into the app. */
export default function Login() {
  const { login, users, brand } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e?.preventDefault?.();
    const r = login(email);
    if (!r.ok) { setError("No enrolment found for that email."); return; }
    navigate(r.role === "admin" ? "/admin" : "/");
  };

  const quick = (e) => {
    setEmail(e);
    const r = login(e);
    navigate(r.role === "admin" ? "/admin" : "/");
  };

  const demos = Object.entries(users);

  return (
    <div className="login-page">
      <style>{LOGIN_CSS}</style>

      <div className="login-left">
        <div className="grid-lines" />
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
        <div className="orb orb-4" /><div className="orb orb-5" />

        <div className="float-card float-card-1">
          <div className="fc-label">Course</div>
          <div className="fc-val">Equity Markets</div>
          <div className="fc-sub">8 sessions · EQ-101</div>
        </div>
        <div className="float-card float-card-2">
          <div className="fc-label">Progress</div>
          <div className="fc-val">4 recordings</div>
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
          <div className="brand-sub">
            Your courses, session recordings and materials in one place — all your learning, in one secure portal.
          </div>
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
            <p>Sign in with the email you enrolled with</p>
          </div>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input id="email" type="text" placeholder="you@email.com" autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn-login">Sign In</button>
          </form>

          <div className="demo-block">
            <div className="demo-label">Demo accounts — tap to sign in</div>
            {demos.map(([e, u]) => (
              <button key={e} className="demo-btn" onClick={() => quick(e)} type="button">
                <span className="db-name">{u.name}
                  <span className={"db-role " + (u.role === "admin" ? "is-admin" : "")}>{u.role}</span>
                </span>
                <span className="db-meta">{u.role === "admin" ? "Full console access" : `${u.enrolled.length} courses`} · {e}</span>
              </button>
            ))}
          </div>

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
.brand-features { display:flex; flex-direction:column; gap:10px; margin-top:28px; }
.brand-feature { display:flex; align-items:center; gap:10px; color:rgba(255,255,255,0.7); font-size:13.5px; font-weight:500; }
.feature-dot { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.5); flex-shrink:0; }
.login-right { width: 50%; display: flex; align-items: center; justify-content: center; padding: 48px; }
.login-box { width: 100%; max-width: 420px; }
.login-header { margin-bottom: 30px; }
.login-header h1 { font-size: 30px; font-weight: 800; color: #121212; margin-bottom: 8px; }
.login-header p { font-size: 14.5px; color: #888; }
.login-box label { display:block; font-size:13px; font-weight:600; color:#3D3D3D; margin-bottom:8px; }
.login-box input[type="text"] {
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
.demo-block { border-top:1px solid #E2EAF4; margin-top:28px; padding-top:20px; }
.demo-label { font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#9CA3AF; margin-bottom:12px; }
.demo-btn {
  width:100%; display:flex; flex-direction:column; align-items:flex-start; gap:3px;
  background:#F4F7FB; border:1.5px solid #E2EAF4; border-radius:10px; padding:11px 14px;
  margin-bottom:9px; cursor:pointer; text-align:left; font-family:'Figtree',sans-serif; transition:border-color .15s;
}
.demo-btn:hover { border-color:#1E509B; }
.db-name { font-size:14px; font-weight:700; color:#121212; display:flex; align-items:center; gap:8px; }
.db-role { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#6B7280; background:#E2EAF4; padding:1px 7px; border-radius:999px; }
.db-role.is-admin { color:#1E509B; background:#EBF2FF; }
.db-meta { font-size:11.5px; color:#9CA3AF; font-weight:500; }
.login-footer { margin-top:28px; text-align:center; font-size:12px; color:#aaa; }
@media (max-width:768px) { .login-left { display:none; } .login-right { width:100%; padding:32px 24px; } }
`;
