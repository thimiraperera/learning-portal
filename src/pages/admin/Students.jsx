import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, CheckCircle, AlertTriangle, Users, Mail, Copy, Search, Eye, X, Lock } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

/* Build a sensible username suggestion from the full name: lowercase,
   strip accents and punctuation. Admins can still type their own. */
function suggestUsername(name) {
  // NFD splits accented letters into base + combining mark; drop the marks
  // (̀-ͯ) so "José" becomes "jose", then keep a-z0-9 only.
  return name.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

const rs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-US");

/* Admin "dashboard" notice: students whose balance is past its due date.
   Locking is always manual, surfaced here for the admin to act on. */
function OverdueNotice({ overdue, lockStudent, navigate }) {
  const [busy, setBusy] = useState(0);
  const byStudent = useMemo(() => {
    const m = {};
    for (const o of overdue || []) {
      (m[o.user_id] ||= { id: o.user_id, name: o.studentName, email: o.studentEmail, items: [], total: 0 });
      m[o.user_id].items.push(o);
      m[o.user_id].total += Number(o.remaining || 0);
    }
    return Object.values(m);
  }, [overdue]);

  if (byStudent.length === 0) return null;

  const lock = async (st) => {
    if (!window.confirm(`Lock ${st.name}? They will be set to inactive and cannot sign in until reactivated. This does not happen automatically.`)) return;
    setBusy(st.id);
    await lockStudent(st.id);
    setBusy(0);
  };

  return (
    <div className="card" style={{ marginBottom: 18, borderLeft: "4px solid var(--danger)" }}>
      <div className="card-title" style={{ color: "var(--danger)" }}>
        <AlertTriangle style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6 }} />
        Payments overdue ({byStudent.length} student{byStudent.length === 1 ? "" : "s"})
      </div>
      <div className="card-subtitle">These students have a past-due balance and may need locking. Review and lock manually, nothing is locked automatically.</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Overdue courses</th><th>Outstanding</th><th></th></tr></thead>
          <tbody>
            {byStudent.map((st) => (
              <tr key={st.id}>
                <td>
                  <button onClick={() => navigate(`/admin/students/${st.id}`)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--primary)", fontFamily: "inherit", fontSize: "inherit", textAlign: "left" }}>
                    {st.name}
                  </button>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{st.email}</div>
                </td>
                <td style={{ color: "#6B7280", fontSize: 13 }}>
                  {st.items.map((o) => (
                    <div key={o.plan_id}>{o.courseCode} - {o.courseTitle} <span style={{ color: "#9CA3AF" }}>(due {o.due_date})</span></div>
                  ))}
                </td>
                <td style={{ whiteSpace: "nowrap", fontWeight: 700, color: "var(--danger)" }}>{rs(st.total)}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" style={{ marginRight: 8 }} onClick={() => navigate(`/admin/students/${st.id}`)}><Eye /> View</button>
                  <button className="btn btn-danger btn-sm" disabled={busy === st.id} onClick={() => lock(st)}><Lock /> {busy === st.id ? "Locking..." : "Lock"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Students() {
  const { users, courses, addStudent, removeStudent, overdue, lockStudent } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, msg, link, sent }

  const [qy, setQy] = useState("");
  const [status, setStatus] = useState("all");
  const [course, setCourse] = useState("all");
  const [gender, setGender] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [fieldErr, setFieldErr] = useState({});

  const onName = (v) => {
    setName(v);
    setFieldErr((e) => ({ ...e, name: undefined }));
    if (!usernameEdited) setUsername(suggestUsername(v));
  };

  const invite = async () => {
    const er = {};
    if (!name.trim()) er.name = "Enter the student's full name.";
    if (!email.trim()) er.email = "Email is required to send the invite.";
    else if (!email.includes("@")) er.email = "Enter a valid email address.";
    if (!username.trim()) er.username = "Username is required.";
    setFieldErr(er);
    setMsg(null);
    if (Object.keys(er).length > 0) return;
    const r = await addStudent(name, email, username);
    setMsg(r);
    if (r.ok) { setName(""); setEmail(""); setUsername(""); setUsernameEdited(false); setFieldErr({}); }
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

      <OverdueNotice overdue={overdue} lockStudent={lockStudent} navigate={navigate} />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Invite a student</div>
        <div className="card-subtitle">No password is set here. The student creates it from the registration link.</div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Full name <span className="req">*</span></label>
          <input className={"form-control" + (fieldErr.name ? " is-invalid" : "")} style={{ width: "100%" }} placeholder="Full name" value={name} onChange={(e) => onName(e.target.value)} />
          {fieldErr.name && <div className="field-error">{fieldErr.name}</div>}
        </div>
        <div className="toolbar" style={{ marginBottom: 0, alignItems: "flex-end" }}>
          <div className="tb-field" style={{ flex: "1 1 180px" }}>
            <label className="form-label">Email <span className="req">*</span></label>
            <input className={"form-control" + (fieldErr.email ? " is-invalid" : "")} style={{ width: "100%" }} placeholder="email@address.com" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErr((er) => ({ ...er, email: undefined })); }} />
            {fieldErr.email && <div className="field-error">{fieldErr.email}</div>}
          </div>
          <div className="tb-field" style={{ flex: "1 1 180px" }}>
            <label className="form-label">Username <span className="req">*</span></label>
            <input className={"form-control" + (fieldErr.username ? " is-invalid" : "")} style={{ width: "100%" }} placeholder="Username" value={username} onChange={(e) => { setUsername(e.target.value); setUsernameEdited(true); setFieldErr((er) => ({ ...er, username: undefined })); }} />
            {fieldErr.username && <div className="field-error">{fieldErr.username}</div>}
          </div>
          <button className="btn btn-primary" onClick={invite}><Mail /> Send invite</button>
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8 }}>A username is suggested from the full name. You can change it before sending.</div>
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
            <option value="inactive">Inactive</option>
            <option value="invited">Invited</option>
          </select>
          <SearchSelect style={{ flex: "1 1 220px" }} value={course} placeholder="All courses" allLabel="All courses"
            options={Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }))}
            onChange={(v) => { setCourse(v); resetPage(); }} />
          <select className="form-control" style={{ flex: "0 0 150px" }} value={gender} onChange={(e) => { setGender(e.target.value); resetPage(); }}>
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
