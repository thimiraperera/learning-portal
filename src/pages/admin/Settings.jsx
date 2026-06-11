import { useState, useEffect } from "react";
import { Save, CheckCircle, AlertTriangle, Trash2, Image, Mail, ShieldCheck, Download, Upload, Database, UserCog, Plus, AlertOctagon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout.jsx";
import TwoFactor from "../../components/TwoFactor.jsx";
import { useStore } from "../../state.jsx";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export default function Settings() {
  const { brand, setBrand, smtp, saveSmtp, hcaptcha, saveHcaptcha, downloadBackup, restoreBackup, resetAll, logout,
    currentUser, fetchAdmins, addAdmin, deleteAdmin } = useStore();
  const navigate = useNavigate();
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

      <div className="settings-grid">
        <div className="settings-col">
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

        <SmtpCard smtp={smtp} saveSmtp={saveSmtp} />
        </div>

        <div className="settings-col">
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

        <HcaptchaCard hcaptcha={hcaptcha} saveHcaptcha={saveHcaptcha} />
        <TwoFactor />
        </div>
      </div>

      <AdminsCard currentUser={currentUser} fetchAdmins={fetchAdmins} addAdmin={addAdmin} deleteAdmin={deleteAdmin} />
      <BackupCard downloadBackup={downloadBackup} restoreBackup={restoreBackup} />
      <ResetCard resetAll={resetAll} logout={logout} navigate={navigate} />
    </Layout>
  );
}

/* Danger zone: wipe all data and start fresh. */
function ResetCard({ resetAll, logout, navigate }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async () => {
    if (!window.confirm("Reset ALL data? This permanently deletes every student, instructor, course, exam, certificate and uploaded file. Branding and SMTP settings are kept. This cannot be undone.")) return;
    const typed = window.prompt('Type RESET to confirm you want to erase all data.');
    if (typed !== "RESET") { setMsg({ ok: false, text: "Reset cancelled." }); return; }
    setBusy(true); setMsg(null);
    const r = await resetAll();
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.msg }); return; }
    setMsg({ ok: true, text: "All data has been reset. Signing you out..." });
    setTimeout(async () => { await logout(); navigate("/login"); }, 1800);
  };

  return (
    <div className="card" style={{ marginTop: 24, border: "1.5px solid #FECACA" }}>
      <div className="card-title"><AlertOctagon style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--danger)" }} />Reset all data</div>
      <div className="card-subtitle">Permanently delete all students, instructors, courses, exams, certificates and uploaded files, and recreate the default admin. Branding and SMTP settings are kept. This cannot be undone.</div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}
      <button className="btn btn-danger" disabled={busy} onClick={run}><Trash2 /> {busy ? "Resetting..." : "Reset all data"}</button>
    </div>
  );
}

function AdminsCard({ currentUser, fetchAdmins, addAdmin, deleteAdmin }) {
  const [admins, setAdmins] = useState(null);
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "" });
  const [fieldErr, setFieldErr] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAdmins().then((a) => { if (alive) setAdmins(a); }).catch(() => { if (alive) setAdmins([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setFieldErr((x) => ({ ...x, [k]: undefined })); };

  const add = async () => {
    const er = {};
    if (!form.name.trim()) er.name = "Enter a full name.";
    if (!form.username.trim()) er.username = "Enter a username.";
    if (!form.email.includes("@")) er.email = "Enter a valid email.";
    if (form.password.length < 6) er.password = "At least 6 characters.";
    setFieldErr(er); setMsg(null);
    if (Object.keys(er).length) return;
    setBusy(true);
    const r = await addAdmin(form);
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.msg }); return; }
    setAdmins(r.admins); setForm({ name: "", username: "", email: "", password: "" });
    setMsg({ ok: true, text: "Administrator added." });
  };

  const remove = async (a) => {
    if (!window.confirm(`Remove administrator "${a.name}" (@${a.username})? They will no longer be able to sign in.`)) return;
    setMsg(null);
    const r = await deleteAdmin(a.id);
    if (!r.ok) { setMsg({ ok: false, text: r.msg }); return; }
    setAdmins(r.admins);
    setMsg({ ok: true, text: "Administrator removed." });
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><UserCog style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Administrators</div>
      <div className="card-subtitle">Add or remove portal administrators. You cannot delete your own account, and at least one admin must remain.</div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}

      {admins === null ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>Loading...</p> : (
        <div className="table-wrap" style={{ marginBottom: 18 }}>
          <table>
            <thead><tr><th>Administrator</th><th>Username</th><th></th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td><div style={{ fontWeight: 700 }}>{a.name}</div><div style={{ fontSize: 12, color: "#9CA3AF" }}>{a.email}</div></td>
                  <td style={{ color: "#6B7280" }}>{a.username}{a.username === currentUser?.username && <span style={{ color: "#9CA3AF" }}> (you)</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    {a.username !== currentUser?.username && (
                      <button className="icon-btn-plain" title="Remove" onClick={() => remove(a)}><Trash2 style={{ width: 16, height: 16 }} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 10px" }}>ADD ADMINISTRATOR</div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">Full name <span className="req">*</span></label>
          <input className={"form-control" + (fieldErr.name ? " is-invalid" : "")} value={form.name} onChange={set("name")} />
          {fieldErr.name && <div className="field-error">{fieldErr.name}</div>}</div>
        <div className="form-group"><label className="form-label">Username <span className="req">*</span></label>
          <input className={"form-control" + (fieldErr.username ? " is-invalid" : "")} value={form.username} onChange={set("username")} />
          {fieldErr.username && <div className="field-error">{fieldErr.username}</div>}</div>
      </div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">Email <span className="req">*</span></label>
          <input className={"form-control" + (fieldErr.email ? " is-invalid" : "")} type="email" value={form.email} onChange={set("email")} />
          {fieldErr.email && <div className="field-error">{fieldErr.email}</div>}</div>
        <div className="form-group"><label className="form-label">Password <span className="req">*</span></label>
          <input className={"form-control" + (fieldErr.password ? " is-invalid" : "")} type="password" value={form.password} onChange={set("password")} />
          {fieldErr.password && <div className="field-error">{fieldErr.password}</div>}</div>
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={add}><Plus /> {busy ? "Adding..." : "Add administrator"}</button>
    </div>
  );
}

function BackupCard({ downloadBackup, restoreBackup }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  const SCOPES = [
    { key: "all", label: "Database + files", icon: Download },
    { key: "db", label: "Database only", icon: Database },
    { key: "files", label: "Files only", icon: Download },
  ];
  const LABELS = { all: "database and files", db: "the database", files: "the course files" };

  const backup = async (scope) => {
    setBusy("backup-" + scope); setMsg(null);
    try { await downloadBackup(scope); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy("");
  };

  const restore = async (scope, file) => {
    if (!file) return;
    if (!window.confirm(`Restore ${LABELS[scope]} from this backup? This OVERWRITES current ${LABELS[scope]} and cannot be undone.`)) return;
    setBusy("restore-" + scope); setMsg(null);
    const r = await restoreBackup(scope, file);
    setBusy("");
    setMsg({ ok: r.ok, text: r.ok ? r.msg : r.msg });
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><Database style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Backup &amp; restore</div>
      <div className="card-subtitle">Download a backup or restore from one. The database is small and reliable through the app; for very large course files, back up the <code>storage/</code> folder over FTP instead.</div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>BACKUP</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        {SCOPES.map((s) => (
          <button key={s.key} className="btn btn-outline" disabled={!!busy} onClick={() => backup(s.key)}>
            <s.icon /> {busy === "backup-" + s.key ? "Preparing..." : s.label}
          </button>
        ))}
      </div>

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>RESTORE</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <RestoreButton label="Database + files (.zip)" scope="all" accept=".zip" busy={busy} onPick={restore} />
        <RestoreButton label="Database (.sql)" scope="db" accept=".sql" busy={busy} onPick={restore} />
        <RestoreButton label="Files (.zip)" scope="files" accept=".zip" busy={busy} onPick={restore} />
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 12 }}>Restoring replaces existing data. You may need to sign in again after a database restore.</div>
    </div>
  );
}

function RestoreButton({ label, scope, accept, busy, onPick }) {
  return (
    <label className="btn btn-ghost" style={{ cursor: busy ? "default" : "pointer" }}>
      <Upload /> {busy === "restore-" + scope ? "Restoring..." : label}
      <input type="file" accept={accept} style={{ display: "none" }} disabled={!!busy}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onPick(scope, f); }} />
    </label>
  );
}

function HcaptchaCard({ hcaptcha, saveHcaptcha }) {
  const h = hcaptcha || {};
  const [enabled, setEnabled] = useState(!!h.enabled);
  const [siteKey, setSiteKey] = useState(h.siteKey || "");
  const [secretKey, setSecretKey] = useState("");
  const [msg, setMsg] = useState(null);

  const save = async () => {
    setMsg(await saveHcaptcha({ enabled, siteKey: siteKey.trim(), secretKey }));
    setSecretKey("");
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><ShieldCheck style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />hCaptcha</div>
      <div className="card-subtitle">Protect the sign-in and registration pages from bots. Get keys from your hCaptcha dashboard.</div>

      {msg && (
        <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>
          {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}
        </div>
      )}

      <label className="check-row" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable hCaptcha on login and registration
      </label>

      <div className="field-row">
        <div className="form-group">
          <label className="form-label">Site key</label>
          <input className="form-control" value={siteKey} placeholder="10000000-ffff-ffff-ffff-000000000001" onChange={(e) => setSiteKey(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Secret key {h.hasSecretKey && <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(leave blank to keep current)</span>}</label>
          <input className="form-control" type="password" value={secretKey} placeholder={h.hasSecretKey ? "********" : ""} onChange={(e) => setSecretKey(e.target.value)} />
        </div>
      </div>

      <button className="btn btn-primary" onClick={save}><Save /> Save hCaptcha settings</button>
    </div>
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
