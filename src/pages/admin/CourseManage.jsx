import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Users, PlayCircle, Link2, FileDown, Save, Trash2, Plus, X, CheckCircle, AlertTriangle,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

const BUCKETS = {
  recordings: { label: "Recording", icon: PlayCircle },
  links: { label: "Link", icon: Link2 },
  materials: { label: "Material", icon: FileDown },
};

export default function CourseManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { courses, users, updateCourse, deleteCourse, addItem, removeItem } = useStore();
  const c = courses[id];

  // Hooks must run unconditionally; seed from the course if present.
  const [code, setCode] = useState(c?.code || "");
  const [title, setTitle] = useState(c?.title || "");
  const [instructor, setInstructor] = useState(c?.instructor || "");
  const [sessions, setSessions] = useState(c?.sessions ?? 0);
  const [blurb, setBlurb] = useState(c?.blurb || "");
  const [msg, setMsg] = useState(null);

  if (!c) return <Navigate to="/admin/courses" replace />;

  const enrolled = Object.entries(users).filter(([, u]) => u.enrolled.includes(id));

  const save = async () => setMsg(await updateCourse(id, { code, title, instructor, sessions, blurb }));
  const remove = async () => {
    if (!window.confirm(`Delete "${c.title}"? This removes its content and enrolments. This cannot be undone.`)) return;
    await deleteCourse(id);
    navigate("/admin/courses");
  };

  return (
    <Layout title="Manage course">
      <button className="back-link" onClick={() => navigate("/admin/courses")}><ArrowLeft /> All courses</button>

      <div className="page-hero">
        <div className="ph-code">{c.code}</div>
        <h1>{c.title}</h1>
      </div>

      <div className="stats-grid">
        <Stat label="Enrolled" value={enrolled.length} icon={Users} bg="#EBF2FF" color="#1E509B" />
        <Stat label="Recordings" value={c.recordings.length} icon={PlayCircle} bg="#EFF6FF" color="#2563EB" />
        <Stat label="Links" value={c.links.length} icon={Link2} bg="#F0FDF4" color="#16A34A" />
        <Stat label="Materials" value={c.materials.length} icon={FileDown} bg="#FFFBEB" color="#D97706" />
      </div>

      {msg && (
        <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>
          {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}
        </div>
      )}

      <div className="account-grid">
        {/* Course details */}
        <div className="card">
          <div className="card-title">Course details</div>
          <div className="card-subtitle">Customize how this course appears to students.</div>

          <div className="field-row">
            <div className="form-group">
              <label className="form-label">Code</label>
              <input className="form-control" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Sessions</label>
              <input className="form-control" type="number" min="0" value={sessions} onChange={(e) => setSessions(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Instructor</label>
            <input className="form-control" value={instructor} onChange={(e) => setInstructor(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows="3" value={blurb} onChange={(e) => setBlurb(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={save}><Save /> Save changes</button>
            <button className="btn btn-danger" onClick={remove}><Trash2 /> Delete course</button>
          </div>
        </div>

        {/* Enrolled students */}
        <div className="card">
          <div className="card-title">Enrolled students ({enrolled.length})</div>
          <div className="card-subtitle">Manage enrolments in Access Control.</div>
          {enrolled.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 12px" }}>
              <div className="empty-icon"><Users /></div>
              <p>No students enrolled yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Email</th></tr></thead>
                <tbody>
                  {enrolled.map(([email, u]) => (
                    <tr key={email}>
                      <td style={{ fontWeight: 700, color: "var(--title)" }}>{u.name}</td>
                      <td style={{ color: "#6B7280" }}>{email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Content management */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">Course content</div>
        <div className="card-subtitle">Add or remove recordings, links and downloadable materials.</div>
        <ContentManager id={id} c={c} addItem={addItem} removeItem={removeItem} />
      </div>
    </Layout>
  );
}

function ContentManager({ id, c, addItem, removeItem }) {
  const [bucket, setBucket] = useState("recordings");
  const [value, setValue] = useState("");

  const attach = async () => { if (value.trim()) { await addItem(id, bucket, value); setValue(""); } };

  const rows = [
    ...c.recordings.map((m) => ({ bucket: "recordings", itemId: m.id, t: m.t })),
    ...c.links.map((m) => ({ bucket: "links", itemId: m.id, t: m.t })),
    ...c.materials.map((m) => ({ bucket: "materials", itemId: m.id, t: m.t })),
  ];

  return (
    <>
      {rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {rows.map((r) => {
            const B = BUCKETS[r.bucket];
            return (
              <div key={r.bucket + r.itemId} className="media-row" style={{ marginBottom: 0, padding: "10px 14px" }}>
                <div className="mr-icon" style={{ width: 34, height: 34 }}><B.icon /></div>
                <div className="mr-body"><div className="mr-title" style={{ marginBottom: 0 }}>{r.t}</div></div>
                <span className="badge badge-info">{B.label}</span>
                <button className="icon-btn-plain" onClick={() => removeItem(id, r.bucket, r.itemId)}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <select className="form-control" value={bucket} onChange={(e) => setBucket(e.target.value)}>
          <option value="recordings">Recording</option>
          <option value="links">Link</option>
          <option value="materials">Material</option>
        </select>
        <input className="form-control" placeholder="Title / URL" value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") attach(); }} />
        <button className="btn btn-ghost" onClick={attach}><Plus /> Attach</button>
      </div>
    </>
  );
}

function Stat({ label, value, icon: Icon, bg, color }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className="stat-label">{label}</div>
        <div className="stat-icon" style={{ background: bg }}><Icon style={{ color }} /></div>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
