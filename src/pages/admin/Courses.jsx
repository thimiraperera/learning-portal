import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PlayCircle, Link2, FileDown, Users, ChevronRight, X, UserPlus, CheckCircle, AlertTriangle, Search } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

const EMPTY = { title: "", code: "", blurb: "", certTemplate: "", instructorIds: [] };

export default function Courses() {
  const { courses, users, instructors, addCourse, fetchCertTemplates } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({}); // { title, code, instructors }
  const [instrSel, setInstrSel] = useState("");
  const [templates, setTemplates] = useState([]);
  const [defaultId, setDefaultId] = useState("");
  const [msg, setMsg] = useState(null);

  const [qy, setQy] = useState("");
  const [fInstructor, setFInstructor] = useState("all");
  const [fStudent, setFStudent] = useState("all");
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

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined })); };
  const defaultName = templates.find((t) => t.id === defaultId)?.name || "Classic";
  const chosenInstructors = form.instructorIds.map((id) => instructors.find((i) => i.id === id)).filter(Boolean);
  const availableInstructors = instructors.filter((i) => !form.instructorIds.includes(i.id));

  const addInstr = (id) => {
    const n = Number(id);
    if (n && !form.instructorIds.includes(n)) setForm((f) => ({ ...f, instructorIds: [...f.instructorIds, n] }));
    setErrors((er) => ({ ...er, instructors: undefined }));
    setInstrSel("");
  };
  const removeInstr = (id) => setForm((f) => ({ ...f, instructorIds: f.instructorIds.filter((x) => x !== id) }));

  const create = async () => {
    const er = {};
    if (!form.title.trim()) er.title = "Enter a course title.";
    if (!form.code.trim()) er.code = "Enter a short course code (e.g. EQ-101).";
    if (form.instructorIds.length === 0) er.instructors = "Assign at least one instructor.";
    setErrors(er);
    setMsg(null);
    if (Object.keys(er).length > 0) return;
    const r = await addCourse({ ...form, sessions: Number(form.sessions) || 0 });
    if (r.ok) navigate(`/admin/courses/${r.id}`);
    else setMsg({ ok: false, msg: r.msg });
  };

  // Student is enrolled in course cid?
  const studentEnrolled = (sid, cid) => Object.values(users).some((u) => u.id === sid && u.enrolled.includes(cid));
  const enrolledCount = (cid) => Object.values(users).filter((u) => u.enrolled.includes(cid)).length;

  const ql = qy.trim().toLowerCase();
  const entries = Object.entries(courses)
    .filter(([, c]) => fInstructor === "all" || c.instructors.some((i) => i.id === Number(fInstructor)))
    .filter(([cid]) => fStudent === "all" || studentEnrolled(Number(fStudent), cid))
    .filter(([, c]) => !ql || c.title.toLowerCase().includes(ql) || c.code.toLowerCase().includes(ql) || (c.blurb || "").toLowerCase().includes(ql));

  const resetPage = () => setPage(1);
  const activeFilters = (fInstructor !== "all") + (fStudent !== "all") + (ql ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = entries.slice((safePage - 1) * pageSize, safePage * pageSize);

  const studentOptions = Object.values(users).filter((u) => u.role === "student").map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));
  const instructorOptions = instructors.map((i) => ({ value: i.id, label: i.title ? `${i.name} (${i.title})` : i.name }));

  return (
    <Layout title="Courses">
      <div className="page-hero">
        <h1>Courses</h1>
        <p>Click a course to manage its content, details and enrolments.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Add a course</div>
        <div className="card-subtitle">Title, code and at least one instructor are required.</div>
        {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}

        <div className="field-row">
          <div className="form-group"><label className="form-label">Title <span className="req">*</span></label>
            <input className={"form-control" + (errors.title ? " is-invalid" : "")} placeholder="Course title" value={form.title} onChange={set("title")} />
            {errors.title && <div className="field-error">{errors.title}</div>}</div>
          <div className="form-group"><label className="form-label">Code <span className="req">*</span></label>
            <input className={"form-control" + (errors.code ? " is-invalid" : "")} placeholder="EQ-101" value={form.code} onChange={set("code")} />
            {errors.code && <div className="field-error">{errors.code}</div>}</div>
        </div>

        <div className="form-group"><label className="form-label">Description</label>
          <textarea className="form-control" rows="2" placeholder="What this course covers." value={form.blurb} onChange={set("blurb")} /></div>

        <div className="field-row">
          <div className="form-group"><label className="form-label">Certificate template</label>
            <select className="form-control" value={form.certTemplate} onChange={set("certTemplate")}>
              <option value="">Default ({defaultName})</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Instructors <span className="req">*</span> <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(at least one)</span></label>
            {instructors.length === 0
              ? <input className="form-control locked-input" value="No instructors created yet" readOnly disabled />
              : <SearchSelect value={instrSel} placeholder="Add an instructor..." showAll={false}
                  options={availableInstructors.map((i) => ({ value: i.id, label: i.title ? `${i.name} (${i.title})` : i.name }))}
                  onChange={addInstr} />}
            {errors.instructors && <div className="field-error">{errors.instructors}</div>}
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

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
            <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search by name or code"
              value={qy} onChange={(e) => { setQy(e.target.value); resetPage(); }} />
          </div>
          <SearchSelect style={{ flex: "0 0 210px" }} value={fInstructor} placeholder="All instructors" allLabel="All instructors"
            options={instructorOptions} onChange={(v) => { setFInstructor(v); resetPage(); }} />
          <SearchSelect style={{ flex: "0 0 210px" }} value={fStudent} placeholder="All students" allLabel="All students"
            options={studentOptions} onChange={(v) => { setFStudent(v); resetPage(); }} />
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setFInstructor("all"); setFStudent("all"); resetPage(); }}><X /> Clear</button>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>{entries.length} of {Object.keys(courses).length} courses</div>

        {entries.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><PlayCircle /></div><p>No courses match.</p></div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </Layout>
  );
}
