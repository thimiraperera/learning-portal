import { Check } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

export default function Access() {
  const { users, courses, toggleEnrol } = useStore();
  const cids = Object.keys(courses);
  const students = Object.entries(users).filter(([, u]) => u.role === "student");
  const enrolledCount = (c) => students.filter(([, s]) => s.enrolled.includes(c)).length;

  return (
    <Layout title="Access Control">
      <div className="page-hero">
        <h1>Access control</h1>
        <p>Tick a cell to enrol. This matrix is the enrolments table, the single source of truth for what each student can open.</p>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Student</th>
                {cids.map((c) => (
                  <th key={c} style={{ textAlign: "center" }}>
                    <div>{courses[c].code}</div>
                    <div style={{ fontWeight: 600, color: "var(--primary)", textTransform: "none", letterSpacing: 0, marginTop: 3 }}>
                      {enrolledCount(c)} enrolled
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(([email, s]) => (
                <tr key={email}>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--title)" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{email}</div>
                  </td>
                  {cids.map((c) => {
                    const on = s.enrolled.includes(c);
                    return (
                      <td key={c} style={{ textAlign: "center" }}>
                        <button className={"cell-btn" + (on ? " on" : "")}
                          onClick={() => toggleEnrol(email, c)}
                          title={on ? "Enrolled" : "Not enrolled"}>
                          {on && <Check />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 16, lineHeight: 1.5 }}>
          In production this writes a row to <code style={{ background: "var(--surface)", padding: "1px 6px", borderRadius: 4, color: "var(--primary)" }}>enrolments(student_id, course_id)</code>.
          Row-level security reads the same table to decide what the student can fetch.
        </p>
      </div>
    </Layout>
  );
}
