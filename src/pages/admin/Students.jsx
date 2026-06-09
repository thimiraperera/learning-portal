import { useState } from "react";
import { Send, Trash2, CheckCircle, AlertTriangle, Users } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

export default function Students() {
  const { users, addStudent, removeStudent } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(null); // { ok, msg }

  const students = Object.entries(users).filter(([, u]) => u.role === "student");

  const invite = () => {
    const r = addStudent(name, email);
    setMsg(r);
    if (r.ok) { setName(""); setEmail(""); }
  };

  return (
    <Layout title="Students">
      <div className="page-hero">
        <h1>Students</h1>
        <p>Add a student by email — an invite goes out automatically. No passwords are ever stored.</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <input className="form-control" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="form-control" placeholder="email@address.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary" onClick={invite}><Send /> Invite</button>
        </div>

        {msg && (
          <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>
            {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}
          </div>
        )}

        {students.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Users /></div><p>No students yet.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Student</th><th>Email</th><th>Status</th><th>Courses</th><th></th></tr>
              </thead>
              <tbody>
                {students.map(([email, s]) => (
                  <tr key={email}>
                    <td style={{ fontWeight: 700, color: "var(--title)" }}>{s.name}</td>
                    <td style={{ color: "#6B7280" }}>{email}</td>
                    <td>
                      <span className={"badge " + (s.status === "active" ? "badge-accepted" : "badge-pending")}>
                        {s.status}
                      </span>
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
        )}
      </div>
    </Layout>
  );
}
