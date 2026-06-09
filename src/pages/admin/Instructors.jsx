import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Presentation, Mail, Phone, CheckCircle, AlertTriangle, Plus, ChevronRight } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import { useStore } from "../../state.jsx";

const EMPTY = { name: "", title: "", email: "", phone: "", gender: "", bio: "" };

export default function Instructors() {
  const { instructors, courses, addInstructor } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const courseCount = (instrId) => Object.values(courses).filter((c) => c.instructors.some((i) => i.id === instrId)).length;

  const pageCount = Math.max(1, Math.ceil(instructors.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = instructors.slice((safePage - 1) * pageSize, safePage * pageSize);

  const submit = async () => {
    const r = await addInstructor(form);
    setMsg(r);
    if (r.ok) setForm(EMPTY);
  };

  return (
    <Layout title="Instructors">
      <div className="page-hero">
        <h1>Instructors</h1>
        <p>Click an instructor to manage their profile and the courses they teach.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Add an instructor</div>
        <div className="card-subtitle">Name is required; the rest is profile information shown across the portal.</div>
        {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
        <div className="field-row">
          <div className="form-group"><label className="form-label">Full name</label>
            <input className="form-control" value={form.name} onChange={set("name")} placeholder="e.g. C. Hettiarachchi" /></div>
          <div className="form-group"><label className="form-label">Title / role</label>
            <input className="form-control" value={form.title} onChange={set("title")} placeholder="e.g. Lead Mentor" /></div>
        </div>
        <div className="field-row">
          <div className="form-group"><label className="form-label">Email</label>
            <input className="form-control" type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" /></div>
          <div className="form-group"><label className="form-label">Phone</label>
            <input className="form-control" value={form.phone} onChange={set("phone")} placeholder="+94 ..." /></div>
        </div>
        <div className="form-group" style={{ maxWidth: 300 }}><label className="form-label">Gender</label>
          <select className="form-control" value={form.gender} onChange={set("gender")}>
            <option value="">Not specified</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select></div>
        <div className="form-group"><label className="form-label">Bio</label>
          <textarea className="form-control" rows="2" value={form.bio} onChange={set("bio")} placeholder="Short background and expertise." /></div>
        <button className="btn btn-primary" onClick={submit}><Plus /> Add instructor</button>
      </div>

      {instructors.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-icon"><Presentation /></div><p>No instructors yet. Add your first one above.</p></div></div>
      ) : (
        <>
          <div className="course-grid">
            {slice.map((i) => (
              <button key={i.id} className="course-card" onClick={() => navigate(`/admin/instructors/${i.id}`)}>
                <div className="cc-top">
                  <span className="cc-code">{i.title || "Instructor"}</span>
                  <span className="cc-sessions">{courseCount(i.id)} course{courseCount(i.id) === 1 ? "" : "s"}</span>
                </div>
                <h3>{i.name}</h3>
                <div className="cc-blurb">{i.bio || "No bio yet."}</div>
                <div className="cc-foot">
                  {i.email && <span className="cc-stat"><Mail /> {i.email}</span>}
                  {i.phone && <span className="cc-stat"><Phone /> {i.phone}</span>}
                  <span className="cc-enter">Manage <ChevronRight /></span>
                </div>
              </button>
            ))}
          </div>
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={instructors.length} />
        </>
      )}
    </Layout>
  );
}
