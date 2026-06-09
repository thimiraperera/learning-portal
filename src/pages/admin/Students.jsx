import { useState } from "react";
import { UserPlus, Trash2, CheckCircle, AlertTriangle, Users } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import StudentProfile from "../../components/StudentProfile.jsx";
import { useStore } from "../../state.jsx";

export default function Students() {
  const { users, courses, addStudent, removeStudent } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null); // { ok, msg }
  const [profile, setProfile] = useState(null);

  const students = Object.entries(users).filter(([, u]) => u.role === "student");

  const add = async () => {
    const r = await addStudent(name, email, username, password);
    setMsg(r);
    if (r.ok) { setName(""); setEmail(""); setUsername(""); setPassword(""); }
  };

  return (
    <Layout title="Students">
      <div className="page-hero">
        <h1>Students</h1>
        <p>Add a student and set their sign-in credentials. They can log in with the username and password right away.</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <input className="form-control" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="form-control" placeholder="email@address.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="form-control" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="form-control" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn btn-primary" onClick={add}><UserPlus /> Add student</button>
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
                <tr><th>Student</th><th>Username</th><th>Email</th><th>Status</th><th>Courses</th><th></th></tr>
              </thead>
              <tbody>
                {students.map(([email, s]) => (
                  <tr key={email}>
                    <td>
                      <button onClick={() => setProfile([email, s])}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--primary)", fontFamily: "inherit", fontSize: "inherit" }}>
                        {s.name}
                      </button>
                    </td>
                    <td style={{ color: "#6B7280" }}>{s.username}</td>
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

      <StudentProfile student={profile} courses={courses} onClose={() => setProfile(null)} />
    </Layout>
  );
}
