import { useState } from "react";
import {
  Presentation, Mail, Phone, Trash2, Pencil, Save, X, CheckCircle, AlertTriangle, Plus,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

const EMPTY = { name: "", title: "", email: "", phone: "", bio: "" };

export default function Instructors() {
  const { instructors, courses, addInstructor, updateInstructor, deleteInstructor } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const courseCount = (instrId) => Object.values(courses).filter((c) => c.instructorId === instrId).length;

  const submit = async () => {
    const r = editId ? await updateInstructor(editId, form) : await addInstructor(form);
    setMsg(r);
    if (r.ok) { setForm(EMPTY); setEditId(null); }
  };
  const startEdit = (i) => { setEditId(i.id); setForm({ name: i.name, title: i.title || "", email: i.email || "", phone: i.phone || "", bio: i.bio || "" }); setMsg(null); };
  const cancelEdit = () => { setEditId(null); setForm(EMPTY); };

  return (
    <Layout title="Instructors">
      <div className="page-hero">
        <h1>Instructors</h1>
        <p>Manage instructor profiles and assign them to courses from each course's Instructor tab.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">{editId ? "Edit instructor" : "Add an instructor"}</div>
        <div className="card-subtitle">Name is required; the rest is profile information shown across the portal.</div>

        {msg && (
          <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>
            {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}
          </div>
        )}

        <div className="field-row">
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-control" value={form.name} onChange={set("name")} placeholder="e.g. C. Hettiarachchi" />
          </div>
          <div className="form-group">
            <label className="form-label">Title / role</label>
            <input className="form-control" value={form.title} onChange={set("title")} placeholder="e.g. Lead Mentor" />
          </div>
        </div>
        <div className="field-row">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-control" value={form.phone} onChange={set("phone")} placeholder="+94 ..." />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Bio</label>
          <textarea className="form-control" rows="3" value={form.bio} onChange={set("bio")} placeholder="Short background and expertise." />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={submit}>
            {editId ? <><Save /> Save instructor</> : <><Plus /> Add instructor</>}
          </button>
          {editId && <button className="btn btn-ghost" onClick={cancelEdit}><X /> Cancel</button>}
        </div>
      </div>

      {instructors.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-icon"><Presentation /></div><p>No instructors yet. Add your first one above.</p></div></div>
      ) : (
        <div className="course-grid">
          {instructors.map((i) => (
            <div key={i.id} className="card" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--title)" }}>{i.name}</div>
                  {i.title && <div style={{ fontSize: 12.5, color: "var(--primary)", fontWeight: 600 }}>{i.title}</div>}
                </div>
                <span className="badge badge-info">{courseCount(i.id)} course{courseCount(i.id) === 1 ? "" : "s"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, margin: "12px 0", fontSize: 13, color: "#6B7280" }}>
                {i.email && <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Mail style={{ width: 14, height: 14 }} /> {i.email}</span>}
                {i.phone && <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Phone style={{ width: 14, height: 14 }} /> {i.phone}</span>}
              </div>
              {i.bio && <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, margin: "0 0 14px" }}>{i.bio}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(i)}><Pencil /> Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm(`Remove ${i.name}?`)) deleteInstructor(i.id); }}>
                  <Trash2 /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
