import { useState, useEffect } from "react";
import { Save, CheckCircle, AlertTriangle, Trash2, Image, Mail, ShieldCheck, Download, Upload, Database, UserCog, Plus, Hash, Bell, LogIn, LayoutGrid } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import TwoFactor from "../../components/TwoFactor.jsx";
import RichTextEditor from "../../components/RichTextEditor.jsx";
import { popup } from "../../components/Popup.jsx";
import Button from "../../components/Button.jsx";
import { resizeToPng } from "../../lib/image.js";
import { useStore } from "../../state.jsx";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export default function Settings() {
  const { brand, setBrand, smtp, saveSmtp, sendTestMail, captcha, saveCaptcha, regnum, saveRegnum, reminders, saveReminders, sendRemindersNow, downloadBackup, restoreBackup,
    currentUser, fetchAdmins, addAdmin, deleteAdmin, purgeData } = useStore();
  const [company, setCompany] = useState(brand.company);
  const [name, setName] = useState(brand.name);
  const [logo, setLogo] = useState(brand.logo);
  const [emailLogo, setEmailLogo] = useState(brand.emailLogo || "");
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

  const onEmailLogo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setEmailLogo(await resizeToPng(f)); setMsg(null); }
    catch (err) { setMsg({ ok: false, text: err.message || "Could not read the image." }); }
  };

  const save = async () => {
    try {
      await setBrand({ company: company.trim(), name: name.trim(), logo, emailLogo });
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

      <div className="settings-masonry">
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

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 20 }}>
            <label className="form-label">
              Email header logo <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(PNG or JPG only, shown at the top of emails)</span>
            </label>
            <div style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 10px" }}>Appears on the dark header of every email. A transparent PNG looks best. WebP is not supported by email clients.</div>
            {emailLogo && (
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <img src={emailLogo} alt="Email logo"
                  style={{ maxHeight: 48, maxWidth: 180, objectFit: "contain", borderRadius: 8, padding: 8, background: "linear-gradient(135deg,#00265E,#1E509B)" }} />
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEmailLogo("")}>
                  <Trash2 /> Remove
                </button>
              </div>
            )}
            <input className="form-control" type="file" accept="image/png,image/jpeg" onChange={onEmailLogo} />
          </div>

          <Button className="btn btn-primary" onClick={save}><Save /> Save Settings</Button>
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

        <SmtpCard smtp={smtp} saveSmtp={saveSmtp} sendTestMail={sendTestMail} />
        <CaptchaCard captcha={captcha} saveCaptcha={saveCaptcha} />
        <RegNumberCard regnum={regnum} saveRegnum={saveRegnum} />
        <RemindersCard reminders={reminders} saveReminders={saveReminders} sendRemindersNow={sendRemindersNow} />
        <LoginPageCard brand={brand} setBrand={setBrand} />
        <CourseCardsCard brand={brand} setBrand={setBrand} />
        <TwoFactor />
        <AdminsCard currentUser={currentUser} fetchAdmins={fetchAdmins} addAdmin={addAdmin} deleteAdmin={deleteAdmin} />
        <BackupCard downloadBackup={downloadBackup} restoreBackup={restoreBackup} />
      </div>

      <DangerZoneCard purgeData={purgeData} />
    </Layout>
  );
}

function DangerZoneCard({ purgeData }) {
  const PHRASE = "DELETE ALL DATA";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async () => {
    if (text !== PHRASE) return;
    if (!(await popup.confirm("This permanently deletes ALL students, instructors, courses, content, payments, exams, certificates and uploaded files. Administrator accounts and settings are kept. This cannot be undone. Continue?", { title: "Delete all data", confirmText: "Delete everything", danger: true }))) return;
    setBusy(true); setMsg(null);
    const r = await purgeData();
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.msg || "Could not delete data." }); return; }
    setText("");
    setMsg({ ok: true, text: "All data deleted. Administrator accounts and settings were kept." });
  };

  return (
    <div className="card" style={{ marginTop: 24, border: "1px solid #FCA5A5" }}>
      <div className="card-title" style={{ color: "#B91C1C" }}>
        <AlertTriangle style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "#DC2626" }} />Danger zone
      </div>
      <div className="card-subtitle">Permanently delete all portal data (students, instructors, courses, content, payments, exams, certificates and uploaded files). Administrator accounts and settings are kept. This cannot be undone, so back up first.</div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}

      <div className="form-group" style={{ maxWidth: 360 }}>
        <label className="form-label">Type <strong>{PHRASE}</strong> to confirm</label>
        <input className="form-control" value={text} placeholder={PHRASE} onChange={(e) => setText(e.target.value)} />
      </div>

      <Button className="btn" style={{ background: "#DC2626", color: "#fff", border: "none", opacity: text === PHRASE && !busy ? 1 : 0.55, cursor: text === PHRASE && !busy ? "pointer" : "not-allowed" }}
        disabled={text !== PHRASE} loading={busy} onClick={run}>
        <Trash2 /> Delete all data
      </Button>
    </div>
  );
}

function LoginPageCard({ brand, setBrand }) {
  const [intro, setIntro] = useState(brand.loginIntro || "");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setIntro(brand.loginIntro || ""); }, [brand.loginIntro]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await setBrand({ loginIntro: intro });
      setMsg({ ok: true, text: "Login page description saved." });
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Could not save the description." });
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><LogIn style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Login page</div>
      <div className="card-subtitle">The description shown beside the sign-in form. Leave it empty to use the default text.</div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}

      <div className="form-group">
        <label className="form-label">Description</label>
        <RichTextEditor value={intro} onChange={setIntro} placeholder="Describe your portal for visitors on the sign-in screen..." />
      </div>

      <Button className="btn btn-primary" loading={busy} onClick={save}><Save /> Save description</Button>
    </div>
  );
}

function CourseCardsCard({ brand, setBrand }) {
  const [words, setWords] = useState(brand.courseCardWords ?? 30);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setWords(brand.courseCardWords ?? 30); }, [brand.courseCardWords]);

  const save = async () => {
    setBusy(true); setMsg(null);
    const n = Math.max(1, Math.min(200, parseInt(words, 10) || 30));
    try {
      await setBrand({ courseCardWords: n });
      setWords(n);
      setMsg({ ok: true, text: `Course cards now show up to ${n} words of the description.` });
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Could not save." });
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><LayoutGrid style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Course cards</div>
      <div className="card-subtitle">How many words of the course description to show on course cards. Keeps cards a consistent height. The full description still shows on the course page.</div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}

      <div className="form-group" style={{ maxWidth: 240 }}>
        <label className="form-label">Description word limit</label>
        <input className="form-control" type="number" min="1" max="200" value={words} onChange={(e) => setWords(e.target.value)} />
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>Between 1 and 200 words. Default is 30.</div>
      </div>

      <Button className="btn btn-primary" loading={busy} onClick={save}><Save /> Save</Button>
    </div>
  );
}

function AdminsCard({ currentUser, fetchAdmins, addAdmin, deleteAdmin }) {
  const [admins, setAdmins] = useState(null);
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", role: "local" });
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
    const r = await addAdmin({ name: form.name, username: form.username, email: form.email, password: form.password, superAdmin: form.role === "super" });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.msg }); return; }
    setAdmins(r.admins); setForm({ name: "", username: "", email: "", password: "", role: "local" });
    setMsg({ ok: true, text: "Administrator added." });
  };

  const remove = async (a) => {
    if (!(await popup.confirm(`Remove administrator "${a.name}" (@${a.username})? They will no longer be able to sign in.`, { title: "Remove administrator", confirmText: "Remove", danger: true }))) return;
    setMsg(null);
    const r = await deleteAdmin(a.id);
    if (!r.ok) { setMsg({ ok: false, text: r.msg }); return; }
    setAdmins(r.admins);
    setMsg({ ok: true, text: "Administrator removed." });
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><UserCog style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Administrators</div>
      <div className="card-subtitle">Add or remove portal administrators. Super admins have full access (including this Settings page); local admins can do everything else but cannot open Settings. You cannot delete your own account, and at least one super admin must remain.</div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}

      {admins === null ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>Loading...</p> : (
        <div className="table-wrap" style={{ marginBottom: 18 }}>
          <table>
            <thead><tr><th>Administrator</th><th>Username</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td><div style={{ fontWeight: 700 }}>{a.name}</div><div style={{ fontSize: 12, color: "#9CA3AF" }}>{a.email}</div></td>
                  <td style={{ color: "#6B7280" }}>{a.username}{a.username === currentUser?.username && <span style={{ color: "#9CA3AF" }}> (you)</span>}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap",
                      background: a.super_admin ? "#E8EFFA" : "#F3F4F6", color: a.super_admin ? "var(--primary)" : "#6B7280" }}>
                      {a.super_admin ? "Super admin" : "Local admin"}
                    </span>
                  </td>
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
      <div className="form-group">
        <label className="form-label">Role <span className="req">*</span></label>
        <select className="form-control" value={form.role} onChange={set("role")}>
          <option value="local">Local admin (everything except Settings)</option>
          <option value="super">Super admin (full access, including Settings)</option>
        </select>
      </div>
      <Button className="btn btn-primary" loading={busy} onClick={add}><Plus /> Add administrator</Button>
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
    if (!(await popup.confirm(`Restore ${LABELS[scope]} from this backup? This OVERWRITES current ${LABELS[scope]} and cannot be undone.`, { title: "Restore backup", confirmText: "Restore", danger: true }))) return;
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
          <Button key={s.key} className="btn btn-outline" loading={busy === "backup-" + s.key} disabled={!!busy} onClick={() => backup(s.key)}>
            <s.icon /> {s.label}
          </Button>
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

const CAPTCHA_INFO = {
  none: { label: "Off", site: "", secret: "", help: "Captcha is disabled. Login and registration are open." },
  hcaptcha: {
    label: "hCaptcha",
    site: "10000000-ffff-ffff-ffff-000000000001",
    secret: "0x0000000000000000000000000000000000000000",
    help: "Get keys from your hCaptcha dashboard (dashboard.hcaptcha.com).",
  },
  recaptcha: {
    label: "Google reCAPTCHA",
    site: "6Lxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    secret: "6Lxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    help: "Use a reCAPTCHA v2 (\"I'm not a robot\" checkbox) site from google.com/recaptcha/admin.",
  },
};

function CaptchaCard({ captcha, saveCaptcha }) {
  const c = captcha || {};
  const [provider, setProvider] = useState(c.provider || "none");
  const [siteKey, setSiteKey] = useState(c.siteKey || "");
  const [secretKey, setSecretKey] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const info = CAPTCHA_INFO[provider] || CAPTCHA_INFO.none;

  const save = async () => {
    setBusy(true); setMsg(null);
    setMsg(await saveCaptcha({ provider, siteKey: siteKey.trim(), secretKey }));
    setSecretKey("");
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><ShieldCheck style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Captcha</div>
      <div className="card-subtitle">Protect the sign-in and registration pages from bots. Choose hCaptcha or Google reCAPTCHA.</div>

      {msg && (
        <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>
          {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Provider</label>
        <select className="form-control" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="none">Off (no captcha)</option>
          <option value="hcaptcha">hCaptcha</option>
          <option value="recaptcha">Google reCAPTCHA (v2)</option>
        </select>
      </div>

      {provider !== "none" && (
        <>
          <div className="field-row">
            <div className="form-group">
              <label className="form-label">Site key</label>
              <input className="form-control" value={siteKey} placeholder={info.site} onChange={(e) => setSiteKey(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Secret key {c.hasSecretKey && <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(leave blank to keep current)</span>}</label>
              <input className="form-control" type="password" value={secretKey} placeholder={c.hasSecretKey ? "********" : info.secret} onChange={(e) => setSecretKey(e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 16 }}>{info.help}</div>
        </>
      )}

      <Button className="btn btn-primary" loading={busy} onClick={save}><Save /> Save captcha settings</Button>
    </div>
  );
}

function RegNumberCard({ regnum, saveRegnum }) {
  const [prefix, setPrefix] = useState(regnum.prefix || "");
  const [width, setWidth] = useState(String(regnum.width || 4));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPrefix(regnum.prefix || ""); setWidth(String(regnum.width || 4)); }, [regnum.prefix, regnum.width]);

  const w = Math.min(12, Math.max(1, Number(width) || 4));
  const example = (prefix || "") + "1".padStart(w, "0");

  const save = async () => {
    setBusy(true); setMsg(null);
    setMsg(await saveRegnum({ prefix: prefix.trim(), width: w }));
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><Hash style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Student registration numbers</div>
      <div className="card-subtitle">Set the format for the auto-generated number each student is given. Numbers already issued never change, this only affects new students.</div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}

      <div className="field-row">
        <div className="form-group">
          <label className="form-label">Prefix <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span></label>
          <input className="form-control" value={prefix} placeholder="e.g. CEM" onChange={(e) => setPrefix(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Number length</label>
          <input className="form-control" type="number" min="1" max="12" value={width} onChange={(e) => setWidth(e.target.value)} />
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 16 }}>Example: <strong style={{ color: "#374151" }}>{example}</strong></div>

      <Button className="btn btn-primary" loading={busy} onClick={save}><Save /> Save format</Button>
    </div>
  );
}

function RemindersCard({ reminders, saveReminders, sendRemindersNow }) {
  const [enabled, setEnabled] = useState(!!reminders.enabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { setEnabled(!!reminders.enabled); }, [reminders.enabled]);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-site";
  const cronUrl = `${origin}/api/cron/payment-reminders?key=${reminders.key || "..."}`;
  const cronCmd = `curl -s "${cronUrl}"`;

  const toggle = async (v) => { setEnabled(v); setMsg(await saveReminders(v)); };
  const sendNow = async () => {
    setBusy(true); setMsg(null);
    const r = await sendRemindersNow();
    setBusy(false);
    setMsg(r.ok
      ? { ok: true, msg: `Sent ${r.sent} reminder${r.sent === 1 ? "" : "s"} (${r.students} student${r.students === 1 ? "" : "s"} overdue${r.failed ? `, ${r.failed} failed` : ""}).` }
      : { ok: false, msg: r.msg });
  };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><Bell style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Overdue payment reminders</div>
      <div className="card-subtitle">Email students whose payments are past due. Reminders need SMTP configured above.</div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}

      <label className="check-row" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} /> Enable daily automatic reminders
      </label>

      <Button className="btn btn-outline" loading={busy} onClick={sendNow}><Mail /> Send reminders now</Button>

      <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 16 }}>
        <label className="form-label">Daily schedule (cPanel Cron Job)</label>
        <div className="card-subtitle" style={{ marginTop: 2 }}>To send automatically each day, add this as a cPanel Cron Job (e.g. once daily). It only sends while the toggle above is on.</div>
        <div style={{ background: "#F8FAFD", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#374151", wordBreak: "break-all" }}>{cronCmd}</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>Keep this URL private; the key lets the job run without logging in.</div>
      </div>
    </div>
  );
}

function SmtpCard({ smtp, saveSmtp, sendTestMail }) {
  const s = smtp || {};
  const [host, setHost] = useState(s.host || "");
  const [username, setUsername] = useState(s.username || "");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(s.fromEmail || "");
  const [fromName, setFromName] = useState(s.fromName || "");
  const [security, setSecurity] = useState(s.security || (s.useSsl ? "ssl" : "starttls"));
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState(null);

  // Port is derived from the encryption mode (SSL 465, STARTTLS 587, none 25).
  const STD_PORT = { ssl: "465", starttls: "587", none: "25" };

  const save = async () => {
    setMsg(await saveSmtp({ host, port: STD_PORT[security] || "587", username, password, fromEmail, fromName, security }));
    setPassword("");
  };

  const sendTest = async () => {
    setTesting(true); setMsg(null);
    const r = await sendTestMail(testTo.trim());
    setTesting(false);
    setMsg(r);
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

      <div className="form-group">
        <label className="form-label">SMTP host</label>
        <input className="form-control" value={host} placeholder="e.g. smtp.gmail.com" onChange={(e) => setHost(e.target.value)} />
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

      <div className="form-group" style={{ maxWidth: 360, marginBottom: 20 }}>
        <label className="form-label">Encryption</label>
        <select className="form-control" value={security} onChange={(e) => setSecurity(e.target.value)}>
          <option value="ssl">SSL/TLS (implicit, port 465)</option>
          <option value="starttls">STARTTLS (port 587)</option>
          <option value="none">None (no encryption)</option>
        </select>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>The connection port is set automatically from this choice.</div>
      </div>

      <Button className="btn btn-primary" onClick={save}><Save /> Save SMTP settings</Button>

      <div style={{ borderTop: "1px solid var(--border)", marginTop: 22, paddingTop: 18 }}>
        <label className="form-label">Send a test email</label>
        <div className="card-subtitle" style={{ marginTop: 2 }}>Save your settings first, then send a test to confirm delivery. Leave blank to send to your own admin email.</div>
        <div className="toolbar" style={{ marginBottom: 0, alignItems: "flex-end" }}>
          <div className="tb-field" style={{ flex: "1 1 220px" }}>
            <input className="form-control" style={{ width: "100%" }} type="email" placeholder="recipient@example.com (optional)"
              value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          </div>
          <Button className="btn btn-outline" loading={testing} disabled={!host} onClick={sendTest}>
            <Mail /> Send test mail
          </Button>
        </div>
      </div>
    </div>
  );
}
