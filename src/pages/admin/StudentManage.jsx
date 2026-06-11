import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, Plus, BookOpen, Settings as SettingsIcon, CheckCircle, AlertTriangle, UserMinus, ChevronRight,
  BarChart3, Award, FileQuestion,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import PhoneInput from "../../components/PhoneInput.jsx";
import { useStore } from "../../state.jsx";

const fmtScore = (v) => parseFloat(Number(v).toFixed(2));
const fmtDateTime = (ts) => new Date(Number(ts)).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function fmtDuration(a, b) {
  const ms = Number(b) - Number(a);
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function StudentManage() {
  const { id } = useParams();
  const sid = Number(id);
  const navigate = useNavigate();
  const store = useStore();
  const entry = Object.entries(store.users).find(([, u]) => u.id === sid);
  const [tab, setTab] = useState("courses"); // courses is the default open tab

  if (!entry) return <Navigate to="/admin/students" replace />;
  const [email, s] = entry;

  const tabs = [
    { k: "profile", label: "Profile", icon: SettingsIcon },
    { k: "courses", label: "Courses", icon: BookOpen, n: s.enrolled.length },
    { k: "overview", label: "Overview", icon: BarChart3 },
  ];

  return (
    <Layout title="Manage student">
      <button className="back-link" onClick={() => navigate("/admin/students")}><ArrowLeft /> All students</button>

      <div className="page-hero">
        <div className="ph-code">Student</div>
        <h1>{s.name}</h1>
        <p>@{s.username} · {s.enrolled.length} course{s.enrolled.length === 1 ? "" : "s"}</p>
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> {t.label}{t.n != null && <span className="tab-count">{t.n}</span>}
            </button>
          ))}
        </div>
        {tab === "profile" && <ProfileTab id={sid} email={email} s={s} store={store} navigate={navigate} />}
        {tab === "courses" && <CoursesTab id={sid} email={email} s={s} store={store} navigate={navigate} />}
        {tab === "overview" && <OverviewTab id={sid} s={s} store={store} navigate={navigate} />}
      </div>
    </Layout>
  );
}

function ProfileTab({ id, s, store, navigate }) {
  const [firstName, setFirstName] = useState(s.firstName || "");
  const [lastName, setLastName] = useState(s.lastName || "");
  const [nickname, setNickname] = useState(s.nickname || "");
  const [email, setEmail] = useState(s.email || "");
  const [phone, setPhone] = useState(s.phone || "");
  const [gender, setGender] = useState(s.gender || "");
  const [notes, setNotes] = useState(s.notes || "");
  const [status, setStatus] = useState(s.status || "active");
  const [msg, setMsg] = useState(null);
  const [fieldErr, setFieldErr] = useState({});
  const invited = s.status === "invited";

  const save = async () => {
    const er = {};
    if (!email.trim()) er.email = "Email is required.";
    else if (!email.includes("@")) er.email = "Enter a valid email address.";
    if (!gender) er.gender = "Select a gender.";
    setFieldErr(er);
    if (Object.keys(er).length > 0) { setMsg(null); return; }
    setMsg(await store.updateStudent(id, { firstName, lastName, nickname, email, phone, gender, notes, status }));
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${s.name}? This deletes the account and its enrolments.`)) return;
    await store.removeStudent(s.email);
    navigate("/admin/students");
  };

  return (
    <div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
      <div className="field-row">
        <div className="form-group"><label className="form-label">Username</label>
          <input className="form-control locked-input" value={s.username} readOnly disabled /></div>
        <div className="form-group"><label className="form-label">Status</label>
          {invited
            ? <input className="form-control locked-input" value="invited (awaiting registration)" readOnly disabled />
            : (
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            )}
        </div>
      </div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">First name</label>
          <input className="form-control" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Last name</label>
          <input className="form-control" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
      </div>
      <div className="form-group"><label className="form-label">Nickname</label>
        <input className="form-control" value={nickname} onChange={(e) => setNickname(e.target.value)} /></div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">Email <span className="req">*</span></label>
          <input className={"form-control" + (fieldErr.email ? " is-invalid" : "")} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErr((x) => ({ ...x, email: undefined })); }} />
          {fieldErr.email && <div className="field-error">{fieldErr.email}</div>}</div>
        <div className="form-group"><label className="form-label">Phone</label>
          <PhoneInput value={phone} onChange={setPhone} /></div>
      </div>
      <div className="form-group" style={{ maxWidth: 300 }}><label className="form-label">Gender <span className="req">*</span></label>
        <select className={"form-control" + (fieldErr.gender ? " is-invalid" : "")} value={gender} onChange={(e) => { setGender(e.target.value); setFieldErr((x) => ({ ...x, gender: undefined })); }}>
          <option value="">Not specified</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        {fieldErr.gender && <div className="field-error">{fieldErr.gender}</div>}</div>
      <div className="form-group"><label className="form-label">Notes <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(admin only)</span></label>
        <textarea className="form-control" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this student." /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={save}><Save /> Save profile</button>
        <button className="btn btn-danger" onClick={remove}><Trash2 /> Remove student</button>
      </div>
    </div>
  );
}

function OverviewTab({ id, s, store, navigate }) {
  const { certificates, loadStudentExams } = store;
  const [attempts, setAttempts] = useState(null); // null = loading
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let alive = true;
    loadStudentExams(id)
      .then((a) => { if (alive) setAttempts(a); })
      .catch(() => { if (alive) setAttempts([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const certs = certificates.filter((c) => c.student_id === id).length;
  const list = attempts || [];
  const avg = list.length
    ? Math.round((list.reduce((n, a) => n + (a.total > 0 ? Number(a.score) / a.total : 0), 0) / list.length) * 100)
    : null;
  // How many times each exam was written (one row per attempt).
  const timesByExam = list.reduce((m, a) => { m[a.exam_id] = (m[a.exam_id] || 0) + 1; return m; }, {});

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = list.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div>
      <div className="stats-grid">
        <OvStat label="Enrolled courses" value={s.enrolled.length} icon={BookOpen} bg="#EBF2FF" color="#1E509B" />
        <OvStat label="Certificates" value={certs} icon={Award} bg="#FFFBEB" color="#D97706" />
        <OvStat label="Exams written" value={attempts === null ? "..." : list.length} icon={FileQuestion} bg="#EFF6FF" color="#2563EB" />
        <OvStat label="Average score" value={attempts === null ? "..." : (avg === null ? "n/a" : `${avg}%`)} icon={BarChart3} bg="#F0FDF4" color="#16A34A" />
      </div>

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>WRITTEN EXAMS ({list.length})</div>
      {attempts === null ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>Loading...</p>
      ) : list.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>No exams written yet.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Exam</th><th>Course</th><th>Score</th><th>Written on</th><th>Time taken</th></tr>
              </thead>
              <tbody>
                {slice.map((a) => {
                  const pct = a.total > 0 ? Math.round((Number(a.score) / a.total) * 100) : 0;
                  const times = timesByExam[a.exam_id] || 1;
                  return (
                    <tr key={a.id}>
                      <td>
                        <button onClick={() => navigate(`/admin/exams/${a.exam_id}`)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--primary)", fontFamily: "inherit", fontSize: "inherit", textAlign: "left" }}>
                          {a.examTitle}
                        </button>
                        {times > 1 && <div style={{ fontSize: 12, color: "#9CA3AF" }}>Written {times} times</div>}
                      </td>
                      <td style={{ color: "#6B7280" }}>{a.course_id ? `${a.courseCode} - ${a.courseTitle}` : "-"}</td>
                      <td><span className={"badge " + (pct >= 50 ? "badge-accepted" : "badge-pending")}>{fmtScore(a.score)}/{a.total} ({pct}%)</span></td>
                      <td style={{ color: "#6B7280", whiteSpace: "nowrap" }}>{fmtDateTime(a.finished_at)}</td>
                      <td style={{ color: "#6B7280" }}>{fmtDuration(a.started_at, a.finished_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={list.length} />
        </>
      )}
    </div>
  );
}

function OvStat({ label, value, icon: Icon, bg, color }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className="stat-label">{label}</div>
        <div className="stat-icon" style={{ background: bg }}><Icon style={{ color }} /></div>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function CoursesTab({ email, s, store, navigate }) {
  const { courses, toggleEnrol } = store;
  const [sel, setSel] = useState("");
  const enrolled = s.enrolled.map((cid) => [cid, courses[cid]]).filter(([, c]) => c);
  const available = Object.entries(courses).filter(([cid]) => !s.enrolled.includes(cid));

  const add = async () => { if (sel) { await toggleEnrol(email, sel); setSel(""); } };

  return (
    <div>
      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ENROLLED ({enrolled.length})</div>
      {enrolled.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 18 }}>Not enrolled in any course yet.</p> : (
        <div style={{ marginBottom: 22 }}>
          {enrolled.map(([cid, c]) => (
            <div key={cid} className="assigned-row">
              <button className="ar-body" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                onClick={() => navigate(`/admin/courses/${cid}`)}>
                <span className="mr-icon" style={{ width: 34, height: 34 }}><BookOpen /></span>
                <span>
                  <span className="ar-title" style={{ display: "block" }}>{c.title}</span>
                  <span className="ar-sub">{c.code}</span>
                </span>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleEnrol(email, cid)}><UserMinus /> Remove</button>
              <ChevronRight style={{ width: 16, height: 16, color: "#9CA3AF" }} />
            </div>
          ))}
        </div>
      )}

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ENROL IN A COURSE</div>
      {available.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>Enrolled in every course already.</p> : (
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <SearchSelect style={{ flex: "1 1 260px" }} value={sel} placeholder="Select a course..." showAll={false}
            options={available.map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }))}
            onChange={setSel} />
          <button className="btn btn-primary" onClick={add}><Plus /> Enrol</button>
        </div>
      )}
    </div>
  );
}
