import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PlayCircle, Link2, FileDown, Users, ChevronRight, X, UserPlus, CheckCircle, AlertTriangle } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

const EMPTY = { title: "", code: "", sessions: 0, blurb: "", certTemplate: "", instructorIds: [] };

export default function Courses() {
  const { courses, users, instructors, addCourse, fetchCertTemplates } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [instrSel, setInstrSel] = useState("");
  const [templates, setTemplates] = useState([]);
  const [defaultId, setDefaultId] = useState("");
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let alive = true;
    fetchCertTemplates()
      .then((d) => { if (alive) { setTemplates(d.templates || []); setDefaultId(d.defaultId || ""); } })
      .catch(() => { /* selector stays empty */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const defaultName = templates.find((t) => t.id === defaultId)?.name || "Classic";
  const chosenInstructors = form.instructorIds.map((id) => instructors.find((i) => i.id === id)).filter(Boolean);
  const availableInstructors = instructors.filter((i) => !form.instructorIds.includes(i.id));

  const addInstr = (id) => {
    const n = Number(id);
    if (n && !form.instructorIds.includes(n)) setForm((f) => ({ ...f, instructorIds: [...f.instructorIds, n] }));
    setInstrSel("");
  };
  const removeInstr = (id) => setForm((f) => ({ ...f, instructorIds: f.instructorIds.filter((x) => x !== id) }));

  const create = async () => {
    if (!form.title.trim() || !form.code.trim()) { setMsg({ ok: false, msg: "Enter a title and a code." }); return; }
    const r = await addCourse({ ...form, sessions: Number(form.sessions) || 0 });
    if (r.ok) navigate(`/admin/courses/${r.id}`);
    else setMsg(r);
  };

  const enrolledCount = (cid) => Object.values(users).filter((u) => u.enrolled.includes(cid)).length;

  const entries = Object.entries(courses);
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = entries.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <Layout title="Courses">
      <div className="page-hero">
        <h1>Courses</h1>
        <p>Click a course to manage its content, details and enrolments.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Add a course</div>
        <div className="card-subtitle">Fill in the details below. You can edit everything later from the course page.</div>
        {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}

        <div className="field-row">
          <div className="form-group"><label className="form-label">Title</label>
            <input className="form-control" placeholder="Course title" value={form.title} onChange={set("title")} /></div>
          <div className="field-row">
            <div className="form-group"><label className="form-label">Code</label>
              <input className="form-control" placeholder="EQ-101" value={form.code} onChange={set("code")} /></div>
            <div className="form-group"><label className="form-label">Sessions</label>
              <input className="form-control" type="number" min="0" value={form.sessions} onChange={set("sessions")} /></div>
          </div>
        </div>

        <div className="form-group"><label className="form-label">Description</label>
          <textarea className="form-control" rows="2" placeholder="What this course covers." value={form.blurb} onChange={set("blurb")} /></div>

        <div className="field-row">
          <div className="form-group"><label className="form-label">Certificate template</label>
            <select className="form-control" value={form.certTemplate} onChange={set("certTemplate")}>
              <option value="">Default ({defaultName})</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Instructors</label>
            {availableInstructors.length === 0 && form.instructorIds.length === 0
              ? <input className="form-control locked-input" value="No instructors created yet" readOnly disabled />
              : <SearchSelect value={instrSel} placeholder="Add an instructor..." showAll={false}
                  options={availableInstructors.map((i) => ({ value: i.id, label: i.title ? `${i.name} (${i.title})` : i.name }))}
                  onChange={addInstr} />}
          </div>
        </div>

        {chosenInstructors.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {chosenInstructors.map((i) => (
              <span key={i.id} className="chip"><UserPlus style={{ width: 13, height: 13 }} /> {i.name}
                <button className="chip-x" onClick={() => removeInstr(i.id)}><X style={{ width: 13, height: 13 }} /></button>
              </span>
            ))}
          </div>
        )}

        <button className="btn btn-primary" onClick={create}><Plus /> Add course</button>
      </div>

      <div className="course-grid">
        {slice.map(([id, c]) => (
          <button key={id} className="course-card" onClick={() => navigate(`/admin/courses/${id}`)}>
            <div className="cc-top">
              <span className="cc-code">{c.code}</span>
              <span className="cc-sessions">{c.sessions} sessions</span>
            </div>
            <h3>{c.title}</h3>
            <div className="cc-blurb">{c.blurb}</div>
            <div className="cc-foot">
              <span className="cc-stat"><PlayCircle /> {c.recordings.length}</span>
              <span className="cc-stat"><Link2 /> {c.links.length}</span>
              <span className="cc-stat"><FileDown /> {c.materials.length}</span>
              <span className="cc-stat"><Users /> {enrolledCount(id)}</span>
              <span className="cc-enter">Manage <ChevronRight /></span>
            </div>
          </button>
        ))}
      </div>
      <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
        pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={entries.length} />
    </Layout>
  );
}
