import { useState } from "react";
import { Save, CheckCircle, AlertTriangle, Trash2, Image, Mail } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export default function Settings() {
  const { brand, setBrand, smtp, saveSmtp } = useStore();
  const [company, setCompany] = useState(brand.company);
  const [name, setName] = useState(brand.name);
  const [logo, setLogo] = useState(brand.logo);
  const [msg, setMsg] = useState(null); // { ok, text }

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setMsg({ ok: false, text: "Please choose an image file (PNG, JPG, SVG)." }); return; }
    if (f.size > MAX_LOGO_BYTES) { setMsg({ ok: false, text: "Logo is larger than 2 MB. Choose a smaller file." }); return; }
    const reader = new FileReader();
    reader.onload = () => { setLogo(reader.result); setMsg(null); };
    reader.readAsDataURL(f);
  };

  const save = async () => {
    try {
      await setBrand({ company: company.trim(), name: name.trim(), logo });
      setMsg({ ok: true, text: "Branding saved. It applies across the portal immediately." });
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Could not save branding." });
    }
  };

  return (
    <Layout title="Settings">
      <div className="page-hero">
        <h1>Settings</h1>
        <p>White-label the portal for this client. Set the name and logo shown in the sidebar and on the sign-in screen.</p>
      </div>

      {msg && (
        <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>
          {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        {/* Branding form */}
        <div className="card">
          <div className="card-title">Branding</div>
          <div className="card-subtitle">Stored on the server and used everywhere the brand appears, on every device.</div>

          <div className="form-group">
            <label className="form-label">Portal name</label>
            <input className="form-control" value={name} placeholder="e.g. Learning Portal"
              onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Company line <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(small text above the name, optional)</span></label>
            <input className="form-control" value={company} placeholder="e.g. Acme Education (Pvt) Ltd"
              onChange={(e) => setCompany(e.target.value)} />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 20 }}>
            <label className="form-label">
              Logo <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(max 2 MB, PNG / JPG / SVG. Replaces the name if set)</span>
            </label>
            {logo && (
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <img src={logo} alt="Current logo"
                  style={{ maxHeight: 48, maxWidth: 180, objectFit: "contain", border: "1px solid var(--border)", borderRadius: 8, padding: 6, background: "white" }} />
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setLogo("")}>
                  <Trash2 /> Remove
                </button>
              </div>
            )}
            <input className="form-control" type="file" accept="image/*" onChange={onFile} />
          </div>

          <button className="btn btn-primary" onClick={save}><Save /> Save Settings</button>
        </div>

        {/* Live preview */}
        <div className="card">
          <div className="card-title">Sidebar preview</div>
          <div className="card-subtitle">How the brand appears to users.</div>
          <div style={{ background: "linear-gradient(180deg,#001A4D 0%,#1E509B 100%)", borderRadius: 12, padding: "22px 20px" }}>
            {logo
              ? <img src={logo} alt="" style={{ maxHeight: 44, maxWidth: 180, objectFit: "contain", display: "block" }} />
              : (
                <>
                  {company && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>{company}</div>}
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.25, marginTop: 5 }}>{name || "Learning Portal"}</div>
                </>
              )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: "#9CA3AF" }}>
            <Image style={{ width: 15, height: 15, color: "var(--primary)" }} />
            Use a transparent PNG/SVG for the cleanest result on the dark sidebar.
          </div>
        </div>
      </div>

      <SmtpCard smtp={smtp} saveSmtp={saveSmtp} />
    </Layout>
  );
}

function SmtpCard({ smtp, saveSmtp }) {
  const s = smtp || {};
  const [host, setHost] = useState(s.host || "");
  const [port, setPort] = useState(s.port || "587");
  const [username, setUsername] = useState(s.username || "");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(s.fromEmail || "");
  const [fromName, setFromName] = useState(s.fromName || "");
  const [useTls, setUseTls] = useState(s.useTls !== false);
  const [useSsl, setUseSsl] = useState(!!s.useSsl);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    setMsg(await saveSmtp({ host, port, username, password, fromEmail, fromName, useTls, useSsl }));
    setPassword("");
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><Mail style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />SMTP email</div>
      <div className="card-subtitle">Outgoing email for invites and notifications. Stored on the server.</div>

      {msg && (
        <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>
          {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}
        </div>
      )}

      <div className="field-row">
        <div className="form-group">
          <label className="form-label">SMTP host</label>
          <input className="form-control" value={host} placeholder="e.g. smtp.gmail.com" onChange={(e) => setHost(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Port</label>
          <input className="form-control" value={port} placeholder="587" onChange={(e) => setPort(e.target.value)} />
        </div>
      </div>

      <div className="field-row">
        <div className="form-group">
          <label className="form-label">Username</label>
          <input className="form-control" value={username} placeholder="you@example.com" onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Password {s.hasPassword && <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(leave blank to keep current)</span>}</label>
          <input className="form-control" type="password" value={password} placeholder={s.hasPassword ? "********" : ""} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>

      <div className="field-row">
        <div className="form-group">
          <label className="form-label">From email</label>
          <input className="form-control" type="email" value={fromEmail} placeholder="noreply@example.com" onChange={(e) => setFromEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">From name</label>
          <input className="form-control" value={fromName} placeholder="Learning Portal" onChange={(e) => setFromName(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, marginBottom: 20 }}>
        <label className="check-row"><input type="checkbox" checked={useTls} onChange={(e) => setUseTls(e.target.checked)} /> Use TLS (port 587)</label>
        <label className="check-row"><input type="checkbox" checked={useSsl} onChange={(e) => setUseSsl(e.target.checked)} /> Use SSL (port 465)</label>
      </div>

      <button className="btn btn-primary" onClick={save}><Save /> Save SMTP settings</button>
    </div>
  );
}
