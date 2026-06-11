import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, Plus, BookOpen, Settings as SettingsIcon, CheckCircle, AlertTriangle, UserMinus, ChevronRight,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

export default function StudentManage() {
  const { id } = useParams();
  const sid = Number(id);
  const navigate = useNavigate();
  const store = useStore();
  const entry = Object.entries(store.users).find(([, u]) => u.id === sid);
  const [tab, setTab] = useState("courses"); // courses is the default open tab

  if (!entry) return <Navigate to="/admin/students" replace />;
  const [email, s] = entry;

  const tabs = [
    { k: "courses", label: "Courses", icon: BookOpen, n: s.enrolled.length },
    { k: "profile", label: "Profile", icon: SettingsIcon },
  ];

  return (
    <Layout title="Manage student">
      <button className="back-link" onClick={() => navigate("/admin/students")}><ArrowLeft /> All students</button>

      <div className="page-hero">
        <div className="ph-code">Student</div>
        <h1>{s.name}</h1>
        <p>@{s.username} · {s.enrolled.length} course{s.enrolled.length === 1 ? "" : "s"}</p>
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> {t.label}{t.n != null && <span className="tab-count">{t.n}</span>}
            </button>
          ))}
        </div>
        {tab === "profile" && <ProfileTab id={sid} email={email} s={s} store={store} navigate={navigate} />}
        {tab === "courses" && <CoursesTab id={sid} email={email} s={s} store={store} navigate={navigate} />}
      </div>
    </Layout>
  );
}

function ProfileTab({ id, s, store, navigate }) {
  const [firstName, setFirstName] = useState(s.firstName || "");
  const [lastName, setLastName] = useState(s.lastName || "");
  const [nickname, setNickname] = useState(s.nickname || "");
  const [email, setEmail] = useState(s.email || "");
  const [phone, setPhone] = useState(s.phone || "");
  const [gender, setGender] = useState(s.gender || "");
  const [notes, setNotes] = useState(s.notes || "");
  const [msg, setMsg] = useState(null);

  const save = async () => setMsg(await store.updateStudent(id, { firstName, lastName, nickname, email, phone, gender, notes }));
  const remove = async () => {
    if (!window.confirm(`Remove ${s.name}? This deletes the account and its enrolments.`)) return;
    await store.removeStudent(s.email);
    navigate("/admin/students");
  };

  return (
    <div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
      <div className="field-row">
        <div className="form-group"><label className="form-label">Username</label>
          <input className="form-control locked-input" value={s.username} readOnly disabled /></div>
        <div className="form-group"><label className="form-label">Status</label>
          <input className="form-control locked-input" value={s.status} readOnly disabled /></div>
      </div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">First name</label>
          <input className="form-control" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Last name</label>
          <input className="form-control" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
      </div>
      <div className="form-group"><label className="form-label">Nickname</label>
        <input className="form-control" value={nickname} onChange={(e) => setNickname(e.target.value)} /></div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">Email</label>
          <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Phone</label>
          <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 ..." /></div>
      </div>
      <div className="form-group" style={{ maxWidth: 300 }}><label className="form-label">Gender</label>
        <select className="form-control" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">Not specified</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select></div>
      <div className="form-group"><label className="form-label">Notes <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(admin only)</span></label>
        <textarea className="form-control" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this student." /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={save}><Save /> Save profile</button>
        <button className="btn btn-danger" onClick={remove}><Trash2 /> Remove student</button>
      </div>
    </div>
  );
}

function CoursesTab({ email, s, store, navigate }) {
  const { courses, toggleEnrol } = store;
  const [sel, setSel] = useState("");
  const enrolled = s.enrolled.map((cid) => [cid, courses[cid]]).filter(([, c]) => c);
  const available = Object.entries(courses).filter(([cid]) => !s.enrolled.includes(cid));

  const add = async () => { if (sel) { await toggleEnrol(email, sel); setSel(""); } };

  return (
    <div>
      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ENROLLED ({enrolled.length})</div>
      {enrolled.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 18 }}>Not enrolled in any course yet.</p> : (
        <div style={{ marginBottom: 22 }}>
          {enrolled.map(([cid, c]) => (
            <div key={cid} className="assigned-row">
              <button className="ar-body" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                onClick={() => navigate(`/admin/courses/${cid}`)}>
                <span className="mr-icon" style={{ width: 34, height: 34 }}><BookOpen /></span>
                <span>
                  <span className="ar-title" style={{ display: "block" }}>{c.title}</span>
                  <span className="ar-sub">{c.code}</span>
                </span>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleEnrol(email, cid)}><UserMinus /> Remove</button>
              <ChevronRight style={{ width: 16, height: 16, color: "#9CA3AF" }} />
            </div>
          ))}
        </div>
      )}

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ENROL IN A COURSE</div>
      {available.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>Enrolled in every course already.</p> : (
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <SearchSelect style={{ flex: "1 1 260px" }} value={sel} placeholder="Select a course..." showAll={false}
            options={available.map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }))}
            onChange={setSel} />
          <button className="btn btn-primary" onClick={add}><Plus /> Enrol</button>
        </div>
      )}
    </div>
  );
}
