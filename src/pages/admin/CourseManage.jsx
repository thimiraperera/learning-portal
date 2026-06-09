import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Users, PlayCircle, Link2, FileDown, Save, Trash2, Plus, X,
  CheckCircle, AlertTriangle, Presentation, Settings as SettingsIcon, Search, UserPlus, UserMinus,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import StudentProfile from "../../components/StudentProfile.jsx";
import { useStore } from "../../state.jsx";

const BUCKETS = {
  recordings: { label: "Recording", icon: PlayCircle },
  links: { label: "Link", icon: Link2 },
  materials: { label: "Material", icon: FileDown },
};

export default function CourseManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useStore();
  const { courses, users } = store;
  const c = courses[id];
  const [tab, setTab] = useState("content"); // content is the default open tab

  if (!c) return <Navigate to="/admin/courses" replace />;

  const enrolledCount = Object.values(users).filter((u) => u.enrolled.includes(id)).length;

  const tabs = [
    { k: "details", label: "Course details", icon: SettingsIcon },
    { k: "content", label: "Course content", icon: PlayCircle },
    { k: "students", label: "Enrolled students", icon: Users, n: enrolledCount },
    { k: "instructor", label: "Instructors", icon: Presentation, n: c.instructors.length },
  ];

  return (
    <Layout title="Manage course">
      <button className="back-link" onClick={() => navigate("/admin/courses")}><ArrowLeft /> All courses</button>

      <div className="page-hero">
        <div className="ph-code">{c.code}</div>
        <h1>{c.title}</h1>
        <p>{c.instructor ? `Instructor: ${c.instructor}` : "No instructor assigned"}</p>
      </div>

      <div className="stats-grid">
        <Stat label="Enrolled" value={enrolledCount} icon={Users} bg="#EBF2FF" color="#1E509B" />
        <Stat label="Recordings" value={c.recordings.length} icon={PlayCircle} bg="#EFF6FF" color="#2563EB" />
        <Stat label="Links" value={c.links.length} icon={Link2} bg="#F0FDF4" color="#16A34A" />
        <Stat label="Materials" value={c.materials.length} icon={FileDown} bg="#FFFBEB" color="#D97706" />
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> {t.label}{t.n != null && <span className="tab-count">{t.n}</span>}
            </button>
          ))}
        </div>

        {tab === "details" && <DetailsTab id={id} c={c} store={store} navigate={navigate} />}
        {tab === "content" && <ContentManager id={id} c={c} store={store} />}
        {tab === "students" && <StudentsTab id={id} store={store} />}
        {tab === "instructor" && <InstructorTab id={id} c={c} store={store} />}
      </div>
    </Layout>
  );
}

function DetailsTab({ id, c, store, navigate }) {
  const [code, setCode] = useState(c.code);
  const [title, setTitle] = useState(c.title);
  const [sessions, setSessions] = useState(c.sessions ?? 0);
  const [blurb, setBlurb] = useState(c.blurb || "");
  const [msg, setMsg] = useState(null);

  const save = async () => setMsg(await store.updateCourse(id, { code, title, sessions, blurb }));
  const remove = async () => {
    if (!window.confirm(`Delete "${c.title}"? This removes its content and enrolments. This cannot be undone.`)) return;
    await store.deleteCourse(id);
    navigate("/admin/courses");
  };

  return (
    <div style={{ maxWidth: 620 }}>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
      <div className="field-row">
        <div className="form-group"><label className="form-label">Code</label>
          <input className="form-control" value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Sessions</label>
          <input className="form-control" type="number" min="0" value={sessions} onChange={(e) => setSessions(e.target.value)} /></div>
      </div>
      <div className="form-group"><label className="form-label">Title</label>
        <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Description</label>
        <textarea className="form-control" rows="3" value={blurb} onChange={(e) => setBlurb(e.target.value)} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={save}><Save /> Save changes</button>
        <button className="btn btn-danger" onClick={remove}><Trash2 /> Delete course</button>
      </div>
    </div>
  );
}

function StudentsTab({ id, store }) {
  const { users, courses, toggleEnrol } = store;
  const [qy, setQy] = useState("");
  const [profile, setProfile] = useState(null);

  const ql = qy.trim().toLowerCase();
  const students = Object.entries(users)
    .filter(([, u]) => u.role === "student")
    .filter(([email, s]) => !ql || s.name.toLowerCase().includes(ql) || email.toLowerCase().includes(ql) || (s.username || "").toLowerCase().includes(ql));
  const enrolled = students.filter(([, s]) => s.enrolled.includes(id));
  const others = students.filter(([, s]) => !s.enrolled.includes(id));

  const Row = ({ email, s, action }) => (
    <div className="assigned-row">
      <button className="ar-body" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} onClick={() => setProfile([email, s])}>
        <div className="ar-title">{s.name}</div>
        <div className="ar-sub">{email}</div>
      </button>
      {action}
    </div>
  );

  return (
    <>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
        <input className="form-control" style={{ paddingLeft: 36 }} placeholder="Search students by name, email or username"
          value={qy} onChange={(e) => setQy(e.target.value)} />
      </div>

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ENROLLED ({enrolled.length})</div>
      {enrolled.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 18 }}>No enrolled students match.</p> : (
        <div style={{ marginBottom: 22 }}>
          {enrolled.map(([email, s]) => (
            <Row key={email} email={email} s={s}
              action={<button className="btn btn-ghost btn-sm" onClick={() => toggleEnrol(email, id)}><UserMinus /> Remove</button>} />
          ))}
        </div>
      )}

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ADD STUDENTS</div>
      {others.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>No other students match.</p> : (
        others.map(([email, s]) => (
          <Row key={email} email={email} s={s}
            action={<button className="btn btn-outline btn-sm" onClick={() => toggleEnrol(email, id)}><UserPlus /> Add</button>} />
        ))
      )}

      <StudentProfile student={profile} courses={courses} onClose={() => setProfile(null)} />
    </>
  );
}

function InstructorTab({ id, c, store }) {
  const { instructors, addCourseInstructor, removeCourseInstructor } = store;
  const [sel, setSel] = useState("");
  const assignedIds = c.instructors.map((i) => i.id);
  const available = instructors.filter((i) => !assignedIds.includes(i.id));

  const add = async () => { if (sel) { await addCourseInstructor(id, Number(sel)); setSel(""); } };

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ASSIGNED ({c.instructors.length})</div>
      {c.instructors.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 18 }}>No instructors assigned yet.</p> : (
        <div style={{ marginBottom: 22 }}>
          {c.instructors.map((i) => (
            <div key={i.id} className="assigned-row">
              <div className="mr-icon" style={{ width: 34, height: 34 }}><Presentation /></div>
              <div className="ar-body">
                <div className="ar-title">{i.name}</div>
                {i.title && <div className="ar-sub">{i.title}</div>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => removeCourseInstructor(id, i.id)}><UserMinus /> Remove</button>
            </div>
          ))}
        </div>
      )}

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ADD INSTRUCTOR</div>
      {instructors.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>No instructors exist yet. Create them in the Instructors section.</p>
      ) : available.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>All instructors are already assigned.</p>
      ) : (
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <select className="form-control" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Select an instructor...</option>
            {available.map((i) => <option key={i.id} value={i.id}>{i.name}{i.title ? ` (${i.title})` : ""}</option>)}
          </select>
          <button className="btn btn-primary" onClick={add}><Plus /> Add instructor</button>
        </div>
      )}
    </div>
  );
}

function ContentManager({ id, c, store }) {
  const { addItem, removeItem } = store;
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
                <button className="icon-btn-plain" onClick={() => removeItem(id, r.bucket, r.itemId)}><X style={{ width: 16, height: 16 }} /></button>
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
          onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") attach(); }} />
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
