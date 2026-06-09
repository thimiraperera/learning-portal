import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Trash2, CheckCircle, AlertTriangle, Users, Mail, Copy } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import { useStore } from "../../state.jsx";

export default function Students() {
  const { users, addStudent, removeStudent } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState(null); // { ok, msg, link, sent }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const students = Object.entries(users).filter(([, u]) => u.role === "student");
  const pageCount = Math.max(1, Math.ceil(students.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = students.slice((safePage - 1) * pageSize, safePage * pageSize);

  const invite = async () => {
    const r = await addStudent(name, email, username);
    setMsg(r);
    if (r.ok) { setName(""); setEmail(""); setUsername(""); }
  };

  return (
    <Layout title="Students">
      <div className="page-hero">
        <h1>Students</h1>
        <p>Invite a student by email. They receive a registration link to confirm their details and set a password.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Invite a student</div>
        <div className="card-subtitle">No password is set here. The student creates it from the registration link.</div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input className="form-control" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
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
        {students.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Users /></div><p>No students yet.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Student</th><th>Username</th><th>Email</th><th>Status</th><th>Courses</th><th></th></tr>
                </thead>
                <tbody>
                  {slice.map(([email, s]) => (
                    <tr key={email}>
                      <td>
                        <button onClick={() => navigate(`/admin/students/${s.id}`)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--primary)", fontFamily: "inherit", fontSize: "inherit" }}>
                          {s.name}
                        </button>
                      </td>
                      <td style={{ color: "#6B7280" }}>{s.username}</td>
                      <td style={{ color: "#6B7280" }}>{email}</td>
                      <td>
                        <span className={"badge " + (s.status === "active" ? "badge-accepted" : "badge-pending")}>{s.status}</span>
                      </td>
                      <td>{s.enrolled.length}</td>
                      <td style={{ textAlign: "right" }}>
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
              pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={students.length} />
          </>
        )}
      </div>
    </Layout>
  );
}
