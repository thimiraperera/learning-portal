import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, Plus, BookOpen, Settings as SettingsIcon, CheckCircle, AlertTriangle, UserMinus,
  ShieldCheck, KeyRound, Copy,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import PhoneInput from "../../components/PhoneInput.jsx";
import { popup } from "../../components/Popup.jsx";
import Button from "../../components/Button.jsx";
import { useStore } from "../../state.jsx";

export default function InstructorManage() {
  const { id } = useParams();
  const iid = Number(id);
  const navigate = useNavigate();
  const store = useStore();
  const instr = store.instructors.find((i) => i.id === iid);
  const [tab, setTab] = useState("profile");

  if (!instr) return <Navigate to="/admin/instructors" replace />;

  const taught = Object.entries(store.courses).filter(([, c]) => c.instructors.some((x) => x.id === iid));

  const tabs = [
    { k: "profile", label: "Profile", icon: SettingsIcon },
    { k: "courses", label: "Courses", icon: BookOpen, n: taught.length },
  ];

  return (
    <Layout title="Manage instructor">
      <button className="back-link" onClick={() => navigate("/admin/instructors")}><ArrowLeft /> All instructors</button>

      <div className="page-hero">
        <div className="ph-code">{instr.title || "Instructor"}</div>
        <h1>{instr.name}</h1>
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> {t.label}{t.n != null && <span className="tab-count">{t.n}</span>}
            </button>
          ))}
        </div>
        {tab === "profile" && <ProfileTab instr={instr} store={store} navigate={navigate} />}
        {tab === "courses" && <CoursesTab iid={iid} taught={taught} store={store} navigate={navigate} />}
      </div>
    </Layout>
  );
}

function ProfileTab({ instr, store, navigate }) {
  const [name, setName] = useState(instr.name);
  const [title, setTitle] = useState(instr.title || "");
  const [email, setEmail] = useState(instr.email || "");
  const [phone, setPhone] = useState(instr.phone || "");
  const [bio, setBio] = useState(instr.bio || "");
  const [gender, setGender] = useState(instr.gender || "");
  const [notes, setNotes] = useState(instr.notes || "");
  const [msg, setMsg] = useState(null);

  const save = async () => setMsg(await store.updateInstructor(instr.id, { name, title, email, phone, bio, gender, notes }));
  const remove = async () => {
    if (!(await popup.confirm(`Remove ${instr.name}? They will be unassigned from all courses.`, { title: "Remove instructor", confirmText: "Remove", danger: true }))) return;
    await store.deleteInstructor(instr.id);
    navigate("/admin/instructors");
  };

  return (
    <div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
      <div className="field-row">
        <div className="form-group"><label className="form-label">Full name</label>
          <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Title / role</label>
          <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      </div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">Email</label>
          <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Phone</label>
          <PhoneInput value={phone} onChange={setPhone} /></div>
      </div>
      <div className="form-group" style={{ maxWidth: 300 }}><label className="form-label">Gender</label>
        <select className="form-control" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">Not specified</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select></div>
      <div className="form-group"><label className="form-label">Bio</label>
        <textarea className="form-control" rows="3" value={bio} onChange={(e) => setBio(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Notes <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(admin only)</span></label>
        <textarea className="form-control" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this instructor." /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button className="btn btn-primary" onClick={save}><Save /> Save profile</Button>
        <Button className="btn btn-danger" onClick={remove}><Trash2 /> Remove instructor</Button>
      </div>

      <LoginAccess instr={instr} store={store} />
    </div>
  );
}

function LoginAccess({ instr, store }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);

  const invite = async () => {
    setBusy(true);
    setRes(await store.inviteInstructorLogin(instr.id));
    setBusy(false);
  };

  const hasLogin = !!instr.user_id;
  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 24, paddingTop: 20 }}>
      <div className="card-title"><KeyRound style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Login access</div>
      <div className="card-subtitle">Give this instructor a portal login. They set their own password from an emailed link and can enable two-factor authentication.</div>

      {res && (
        <>
          <div className={"alert " + (res.ok ? "alert-success" : "alert-danger")}>{res.ok ? <CheckCircle /> : <AlertTriangle />} {res.msg}</div>
          {res.ok && res.link && !res.sent && (
            <div className="invite-link" style={{ marginBottom: 14 }}>
              <code>{res.link}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(res.link)}><Copy /> Copy</button>
            </div>
          )}
        </>
      )}

      {hasLogin ? (
        <div className="twofa-status on" style={{ maxWidth: 480 }}>
          <ShieldCheck />
          <span>
            Login enabled (username <strong>{instr.loginUsername}</strong>, {instr.loginStatus === "invited" ? "awaiting registration" : instr.loginStatus})
            {instr.twoFactor ? " · 2FA on" : " · 2FA off"}
          </span>
        </div>
      ) : (
        <Button className="btn btn-outline" loading={busy} onClick={invite}><KeyRound /> Invite to log in</Button>
      )}
    </div>
  );
}

function CoursesTab({ iid, taught, store, navigate }) {
  const { courses, addCourseInstructor, removeCourseInstructor } = store;
  const [sel, setSel] = useState("");
  const taughtIds = taught.map(([id]) => id);
  const available = Object.entries(courses).filter(([id]) => !taughtIds.includes(id));

  const add = async () => { if (sel) { await addCourseInstructor(sel, iid); setSel(""); } };

  return (
    <div>
      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>TEACHING ({taught.length})</div>
      {taught.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 18 }}>Not assigned to any course yet.</p> : (
        <div style={{ marginBottom: 22 }}>
          {taught.map(([id, c]) => (
            <div key={id} className="assigned-row">
              <button className="ar-body" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                onClick={() => navigate(`/admin/courses/${id}`)}>
                <span className="mr-icon" style={{ width: 34, height: 34 }}><BookOpen /></span>
                <span>
                  <span className="ar-title" style={{ display: "block" }}>{c.title}</span>
                  <span className="ar-sub">{c.code}</span>
                </span>
              </button>
              <Button className="btn btn-ghost btn-sm" onClick={() => removeCourseInstructor(id, iid)}><UserMinus /> Remove</Button>
            </div>
          ))}
        </div>
      )}

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ADD TO A COURSE</div>
      {available.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>Assigned to every course already.</p> : (
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <select className="form-control" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Select a course...</option>
            {available.map(([id, c]) => <option key={id} value={id}>{c.code} - {c.title}</option>)}
          </select>
          <Button className="btn btn-primary" onClick={add}><Plus /> Add to course</Button>
        </div>
      )}
    </div>
  );
}
