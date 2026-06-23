import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, X, Eye, Trash2, FileQuestion, AlertTriangle } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { popup } from "../../components/Popup.jsx";
import { useStore } from "../../state.jsx";

export default function Exams() {
  const { exams, courses, createExam, deleteExam } = useStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [courseSel, setCourseSel] = useState("all");
  const [msg, setMsg] = useState(null);

  const [qy, setQy] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const courseOptions = Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }));

  const create = async () => {
    if (!title.trim()) { setMsg({ ok: false, msg: "Enter an exam title." }); return; }
    const r = await createExam(title.trim(), courseSel === "all" ? "" : courseSel);
    if (r.ok) { setTitle(""); setCourseSel("all"); navigate(`/admin/exams/${r.id}`); }
    else setMsg(r);
  };

  const remove = async (x) => {
    if (!(await popup.confirm(`Delete "${x.title}"? This removes its questions and results. This cannot be undone.`, { title: "Delete exam", confirmText: "Delete", danger: true }))) return;
    await deleteExam(x.id);
  };

  const ql = qy.trim().toLowerCase();
  const filtered = exams
    .filter((x) => courseFilter === "all" || x.course_id === courseFilter)
    .filter((x) => !ql || x.title.toLowerCase().includes(ql) || (x.courseTitle || "").toLowerCase().includes(ql));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeFilters = (courseFilter !== "all") + (ql ? 1 : 0);

  return (
    <Layout title="Exams">
      <div className="page-hero">
        <h1>Exams</h1>
        <p>Build an MCQ question bank per exam, assign it to a course, and set how many questions each attempt draws and the time limit. Questions and answer order are shuffled for every attempt.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Create an exam</div>
        <div className="card-subtitle">You can add questions, import a CSV paper and change settings on the next screen.</div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input className="form-control" placeholder="Exam title (e.g. EQ-101 Final Paper)" value={title}
            onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} />
          <SearchSelect style={{ flex: "0 0 260px" }} value={courseSel} placeholder="Assign to course (optional)" allLabel="No course yet"
            options={courseOptions} onChange={setCourseSel} />
          <button className="btn btn-primary" onClick={create}><Plus /> Create exam</button>
        </div>
        {msg && !msg.ok && (
          <div className="alert alert-danger" style={{ marginTop: 16, marginBottom: 0 }}><AlertTriangle /> {msg.msg}</div>
        )}
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
            <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search by exam or course"
              value={qy} onChange={(e) => { setQy(e.target.value); setPage(1); }} />
          </div>
          <SearchSelect style={{ flex: "0 0 220px" }} value={courseFilter} placeholder="All courses" allLabel="All courses"
            options={courseOptions} onChange={(v) => { setCourseFilter(v); setPage(1); }} />
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setCourseFilter("all"); setPage(1); }}>
              <X /> Clear
            </button>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>{filtered.length} of {exams.length} exams</div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><FileQuestion /></div><p>No exams match.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Exam</th><th>Course</th><th>Question bank</th><th>Per attempt</th><th>Time limit</th><th>Attempts</th><th></th></tr>
                </thead>
                <tbody>
                  {slice.map((x) => (
                    <tr key={x.id}>
                      <td>
                        <button onClick={() => navigate(`/admin/exams/${x.id}`)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--primary)", fontFamily: "inherit", fontSize: "inherit", textAlign: "left" }}>
                          {x.title}
                        </button>
                      </td>
                      <td style={{ color: "#6B7280" }}>{x.course_id ? `${x.courseCode} - ${x.courseTitle}` : <span style={{ color: "#9CA3AF" }}>Not assigned</span>}</td>
                      <td>{x.bankSize}</td>
                      <td>{x.question_count > 0 ? Math.min(x.question_count, x.bankSize) || x.question_count : "All"}</td>
                      <td>{x.time_limit > 0 ? `${x.time_limit} min` : "None"}</td>
                      <td>{x.attempts}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/exams/${x.id}`)} style={{ marginRight: 8 }}>
                          <Eye /> Manage
                        </button>
                        <button className="icon-btn-plain" title="Delete" onClick={() => remove(x)}>
                          <Trash2 style={{ width: 16, height: 16 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
              pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={filtered.length} />
          </>
        )}
      </div>
    </Layout>
  );
}
