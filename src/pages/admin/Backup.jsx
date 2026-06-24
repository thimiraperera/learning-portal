import { useState } from "react";
import { Database, Download, CheckCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Button from "../../components/Button.jsx";
import { useStore } from "../../state.jsx";

/* Backup downloads, available to every admin (super or local). Restoring a
   backup stays super-admin only (in Settings) because it overwrites data. */
const SCOPES = [
  { key: "all", label: "Database + files", sub: "Everything: the database and all uploaded course files (.zip)." },
  { key: "db", label: "Database only", sub: "Students, courses, payments, exams, certificates and settings (.sql)." },
  { key: "files", label: "Files only", sub: "Uploaded course materials from the storage folder (.zip)." },
];

export default function Backup() {
  const { downloadBackup, currentUser } = useStore();
  const [msg, setMsg] = useState(null);

  const get = async (scope) => {
    setMsg(null);
    try { await downloadBackup(scope); }
    catch (e) { setMsg({ ok: false, text: e.message || "Could not prepare the backup." }); }
  };

  return (
    <Layout title="Backup">
      <div className="page-hero">
        <h1>Backup</h1>
        <p>Download a copy of your portal data. Keep these files somewhere safe.</p>
      </div>

      {msg && (
        <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>
          {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}
        </div>
      )}

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-title"><Database style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Download a backup</div>
        <div className="card-subtitle">For very large course libraries, back up the storage folder over FTP instead.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
          {SCOPES.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "var(--title)" }}>{s.label}</div>
                <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 2 }}>{s.sub}</div>
              </div>
              <Button className="btn btn-outline" onClick={() => get(s.key)}><Download /> Download</Button>
            </div>
          ))}
        </div>

        <div className="alert alert-info" style={{ marginTop: 18, marginBottom: 0 }}>
          <ShieldAlert />
          <span>{currentUser?.superAdmin
            ? "Restoring a backup is in Settings -> Backup & restore (it overwrites current data)."
            : "Only a super administrator can restore a backup, since restoring overwrites current data."}</span>
        </div>
      </div>
    </Layout>
  );
}
