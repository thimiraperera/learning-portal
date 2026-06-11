import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Presentation, CheckCircle, AlertTriangle, Plus, Eye, Trash2, Search, X } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

const EMPTY = { name: "", title: "", email: "", phone: "", gender: "", bio: "" };

export default function Instructors() {
  const { instructors, courses, addInstructor, deleteInstructor } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);

  const [qy, setQy] = useState("");
  const [gender, setGender] = useState("all");
  const [course, setCourse] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const courseCount = (instrId) => Object.values(courses).filter((c) => c.instructors.some((i) => i.id === instrId)).length;
  const teaches = (instrId, cid) => (courses[cid]?.instructors || []).some((i) => i.id === instrId);

  const submit = async () => {
    const r = await addInstructor(form);
    setMsg(r);
    if (r.ok) setForm(EMPTY);
  };

  const ql = qy.trim().toLowerCase();
  const filtered = instructors
    .filter((i) => gender === "all" || i.gender === gender)
    .filter((i) => course === "all" || teaches(i.id, course))
    .filter((i) => !ql || i.name.toLowerCase().includes(ql) || (i.title || "").toLowerCase().includes(ql) || (i.email || "").toLowerCase().includes(ql));

  const resetPage = () => setPage(1);
  const activeFilters = (gender !== "all") + (course !== "all") + (ql ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const nameBtn = { background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--primary)", fontFamily: "inherit", fontSize: "inherit", textAlign: "left" };

  return (
    <Layout title="Instructors">
      <div className="page-hero">
        <h1>Instructors</h1>
        <p>Add instructors and manage their profiles. Click an instructor to manage their profile and courses.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Add an instructor</div>
        <div className="card-subtitle">Name is required; the rest is profile information shown across the portal.</div>
        {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
        <div className="form-group" style={{ marginBottom: 10 }}>
          <input className="form-control" style={{ width: "100%" }} placeholder="Full name" value={form.name} onChange={set("name")} />
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input className="form-control" placeholder="Title / role" value={form.title} onChange={set("title")} />
          <input className="form-control" placeholder="email@address.com" value={form.email} onChange={set("email")} />
          <input className="form-control" placeholder="Phone" value={form.phone} onChange={set("phone")} />
          <select className="form-control" style={{ flex: "0 0 140px" }} value={form.gender} onChange={set("gender")}>
            <option value="">Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <button className="btn btn-primary" onClick={submit}><Plus /> Add instructor</button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
            <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search by name, title or email"
              value={qy} onChange={(e) => { setQy(e.target.value); resetPage(); }} />
          </div>
          <SearchSelect style={{ flex: "0 0 200px" }} value={course} placeholder="All courses" allLabel="All courses"
            options={Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }))}
            onChange={(v) => { setCourse(v); resetPage(); }} />
          <select className="form-control" style={{ flex: "0 0 140px" }} value={gender} onChange={(e) => { setGender(e.target.value); resetPage(); }}>
            <option value="all">Any gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setGender("all"); setCourse("all"); resetPage(); }}><X /> Clear</button>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>{filtered.length} of {instructors.length} instructors</div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Presentation /></div><p>No instructors match.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Instructor</th><th>Title</th><th>Courses</th><th></th></tr>
                </thead>
                <tbody>
                  {slice.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <button onClick={() => navigate(`/admin/instructors/${i.id}`)} style={nameBtn}>{i.name}</button>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{i.email || "No email"}</div>
                      </td>
                      <td style={{ color: "#6B7280" }}>{i.title || "Not set"}</td>
                      <td>{courseCount(i.id)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/instructors/${i.id}`)} style={{ marginRight: 8 }}><Eye /> View</button>
                        <button className="icon-btn-plain" title="Remove" onClick={() => { if (window.confirm(`Remove ${i.name}?`)) deleteInstructor(i.id); }}>
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
