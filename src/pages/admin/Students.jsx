import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, CheckCircle, AlertTriangle, Users, Mail, Copy, Search, Eye, X } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

export default function Students() {
  const { users, courses, addStudent, removeStudent } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState(null); // { ok, msg, link, sent }

  const [qy, setQy] = useState("");
  const [status, setStatus] = useState("all");
  const [course, setCourse] = useState("all");
  const [gender, setGender] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const invite = async () => {
    const r = await addStudent(name, email, username);
    setMsg(r);
    if (r.ok) { setName(""); setEmail(""); setUsername(""); }
  };

  const ql = qy.trim().toLowerCase();
  const all = Object.entries(users).filter(([, u]) => u.role === "student");
  const filtered = all
    .filter(([, s]) => status === "all" || s.status === status)
    .filter(([, s]) => course === "all" || s.enrolled.includes(course))
    .filter(([, s]) => gender === "all" || s.gender === gender)
    .filter(([e, s]) => !ql || s.name.toLowerCase().includes(ql) || e.toLowerCase().includes(ql) || (s.username || "").toLowerCase().includes(ql));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const resetPage = () => setPage(1);
  const activeFilters = (status !== "all") + (course !== "all") + (gender !== "all") + (ql ? 1 : 0);

  return (
    <Layout title="Students">
      <div className="page-hero">
        <h1>Students</h1>
        <p>Invite a student by email. They receive a registration link to confirm their details and set a password.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Invite a student</div>
        <div className="card-subtitle">No password is set here. The student creates it from the registration link.</div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <input className="form-control" style={{ width: "100%" }} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input className="form-control" placeholder="email@address.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="form-control" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button className="btn btn-primary" onClick={invite}><Mail /> Send invite</button>
        </div>
        {msg && (
          <>
            <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")} style={{ marginTop: 16, marginBottom: msg.link ? 8 : 0 }}>
              {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}
            </div>
            {msg.link && (
              <div className="invite-link">
                <code>{msg.link}</code>
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(msg.link)}><Copy /> Copy</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
            <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search by name, email or username"
              value={qy} onChange={(e) => { setQy(e.target.value); resetPage(); }} />
          </div>
          <select className="form-control" style={{ flex: "0 0 150px" }} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
          </select>
          <SearchSelect style={{ flex: "0 0 200px" }} value={course} placeholder="All courses" allLabel="All courses"
            options={Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }))}
            onChange={(v) => { setCourse(v); resetPage(); }} />
          <select className="form-control" style={{ flex: "0 0 140px" }} value={gender} onChange={(e) => { setGender(e.target.value); resetPage(); }}>
            <option value="all">Any gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setStatus("all"); setCourse("all"); setGender("all"); resetPage(); }}>
              <X /> Clear
            </button>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>{filtered.length} of {all.length} students</div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Users /></div><p>No students match.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Student</th><th>Username</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {slice.map(([email, s]) => (
                    <tr key={email}>
                      <td>
                        <button onClick={() => navigate(`/admin/students/${s.id}`)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--primary)", fontFamily: "inherit", fontSize: "inherit", textAlign: "left" }}>
                          {s.name}
                        </button>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{email}</div>
                      </td>
                      <td style={{ color: "#6B7280" }}>{s.username}</td>
                      <td><span className={"badge " + (s.status === "active" ? "badge-accepted" : "badge-pending")}>{s.status}</span></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/students/${s.id}`)} style={{ marginRight: 8 }}>
                          <Eye /> View
                        </button>
                        <button className="icon-btn-plain" title="Remove" onClick={() => removeStudent(email)}>
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
