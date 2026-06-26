import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, Plus, BookOpen, Settings as SettingsIcon, CheckCircle, AlertTriangle, UserMinus, ChevronRight,
  BarChart3, Award, FileQuestion, Wallet, Lock, Unlock, Receipt, Activity,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import PhoneInput from "../../components/PhoneInput.jsx";
import { popup } from "../../components/Popup.jsx";
import Button from "../../components/Button.jsx";
import { useStore } from "../../state.jsx";
import { rs, fmtDate, planBadge, instBadge, buildDeleteWarning } from "../../lib/payments.js";

const fmtScore = (v) => parseFloat(Number(v).toFixed(2));
const fmtDateTime = (ts) => new Date(Number(ts)).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function fmtDuration(a, b) {
  const ms = Number(b) - Number(a);
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
const ACTION_LABELS = { login: "Login", register: "Registered", material: "Material", material_link: "Material link",
  recording: "Recording", link: "Link", exam_start: "Exam started", exam_submit: "Exam submitted", certificate: "Certificate" };
const actionLabel = (a) => ACTION_LABELS[a] || a;
const actionBadge = (a) => ({ login: "badge-muted", register: "badge-muted", exam_submit: "badge-accepted",
  certificate: "badge-pending", exam_start: "badge-pending" }[a] || "badge-muted");

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
    { k: "payments", label: "Payments", icon: Wallet },
    { k: "history", label: "Payment history", icon: Receipt },
    { k: "activity", label: "Activity", icon: Activity },
    { k: "overview", label: "Overview", icon: BarChart3 },
  ];

  return (
    <Layout title="Manage student">
      <button className="back-link" onClick={() => navigate("/admin/students")}><ArrowLeft /> All students</button>

      <div className="page-hero">
        <div className="ph-code">Student{s.reg_no ? ` · ${s.reg_no}` : ""}</div>
        <h1>{s.name}</h1>
        <p>@{s.username} · {s.enrolled.length} course{s.enrolled.length === 1 ? "" : "s"}</p>
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> <span className="tab-label">{t.label}</span>{t.n != null && <span className="tab-count">{t.n}</span>}
            </button>
          ))}
        </div>
        {tab === "profile" && <ProfileTab id={sid} email={email} s={s} store={store} navigate={navigate} />}
        {tab === "courses" && <CoursesTab id={sid} email={email} s={s} store={store} navigate={navigate} />}
        {tab === "payments" && <PaymentsTab id={sid} s={s} store={store} />}
        {tab === "history" && <PaymentHistoryTab id={sid} store={store} />}
        {tab === "activity" && <ActivityTab id={sid} store={store} />}
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
  const [nic, setNic] = useState(s.nic || "");
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
    setMsg(await store.updateStudent(id, { firstName, lastName, nickname, email, phone, gender, notes, nic, status }));
  };
  const remove = async () => {
    const warning = buildDeleteWarning(s.name, (store.plans || []).filter((p) => p.user_id === id));
    if (!(await popup.confirm(warning, { title: "Delete this student permanently?", confirmText: "Delete permanently", danger: true }))) return;
    await store.removeStudent(s.email);
    navigate("/admin/students");
  };

  return (
    <div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
      <div className="field-row">
        <div className="form-group"><label className="form-label">Registration number</label>
          <input className="form-control locked-input" value={s.reg_no || "(assigned on first registration)"} readOnly disabled /></div>
        <div className="form-group"><label className="form-label">NIC <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional, admin only)</span></label>
          <input className="form-control" value={nic} placeholder="NIC number" onChange={(e) => setNic(e.target.value)} /></div>
      </div>
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
        <Button className="btn btn-primary" onClick={save}><Save /> Save profile</Button>
        <Button className="btn btn-danger" onClick={remove}><Trash2 /> Remove student</Button>
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
                      <td style={{ color: "#6B7280" }}>{a.course_id ? a.courseTitle : "-"}</td>
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

/* Admin-only audit trail of what the student did in the portal. */
function ActivityTab({ id, store }) {
  const { fetchStudentActivity, clearStudentActivity } = store;
  const [rows, setRows] = useState(null); // null = loading
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    let alive = true;
    fetchStudentActivity(id).then((a) => { if (alive) setRows(a); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const clear = async () => {
    if (!(await popup.confirm("Clear this student's entire activity log? This cannot be undone.",
      { title: "Clear activity log", confirmText: "Clear", danger: true }))) return;
    setRows(await clearStudentActivity(id));
    setPage(1);
  };

  if (rows === null) return <p style={{ color: "#9CA3AF", fontSize: 13 }}>Loading...</p>;

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div className="card-subtitle" style={{ marginTop: 0, marginBottom: 0 }}>Logins, materials, recordings, links, exams and certificate downloads, newest first.</div>
        {rows.length > 0 && <Button className="btn btn-ghost btn-sm" onClick={clear}><Trash2 /> Clear</Button>}
      </div>
      {rows.length === 0 ? (
        <div className="empty-state"><div className="empty-icon"><Activity /></div><p>No activity recorded yet.</p></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead>
              <tbody>
                {slice.map((a) => (
                  <tr key={a.id}>
                    <td style={{ color: "#6B7280", whiteSpace: "nowrap" }}>{fmtDateTime(a.created_at)}</td>
                    <td><span className={"badge " + actionBadge(a.action)}>{actionLabel(a.action)}</span></td>
                    <td style={{ color: "#6B7280" }}>{a.detail || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={rows.length} />
        </>
      )}
    </div>
  );
}

function CoursesTab({ id, email, s, store, navigate }) {
  const { courses, toggleEnrol, setCourseLock, plans } = store;
  const [sel, setSel] = useState("");
  const enrolled = s.enrolled.map((cid) => [cid, courses[cid]]).filter(([, c]) => c);
  const available = Object.entries(courses).filter(([cid]) => !s.enrolled.includes(cid));
  const lockedSet = new Set(s.lockedCourses || []);
  const planByCourse = {};
  (plans || []).forEach((p) => { if (p.user_id === id) planByCourse[p.course_id] = p; });

  const add = async () => { if (sel) { await toggleEnrol(email, sel); setSel(""); } };

  // Move the student to a different batch of a course they are already in.
  const moveBatch = async (cid, c, newBatchId) => {
    const curNum = s.enrolledBatch ? s.enrolledBatch[cid] : null;
    const cur = (c.batches || []).find((b) => b.number === curNum);
    const target = (c.batches || []).find((b) => String(b.id) === String(newBatchId));
    if (!target || (cur && String(cur.id) === String(newBatchId))) return; // same batch / unknown -> no-op
    if (!(await popup.confirm(`Move ${s.name} to Batch ${target.number} of "${c.title}"? Their fee schedule switches to Batch ${target.number}'s plan (recorded payments are kept).`,
      { title: "Move to batch", confirmText: `Move to Batch ${target.number}` }))) return;
    await toggleEnrol(email, cid, newBatchId);
    popup.toast(`Moved to Batch ${target.number}`);
  };

  return (
    <div>
      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ENROLLED ({enrolled.length})</div>
      {enrolled.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 18 }}>Not enrolled in any course yet.</p> : (
        <div style={{ marginBottom: 22 }}>
          {enrolled.map(([cid, c]) => {
            const locked = lockedSet.has(cid);
            const plan = planByCourse[cid];
            const pb = planBadge(plan ? plan.status : "empty");
            const curNum = s.enrolledBatch ? s.enrolledBatch[cid] : null;
            const curBatch = (c.batches || []).find((b) => b.number === curNum);
            const batchOptions = (c.batches || []).map((b) => ({ value: String(b.id), label: `Batch ${b.number}${b.status === "ended" ? " (ended)" : ""}` }));
            return (
              <div key={cid} className="assigned-row">
                <button className="ar-body" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                  onClick={() => navigate(`/admin/courses/${cid}`)}>
                  <span className="mr-icon" style={{ width: 34, height: 34 }}><BookOpen /></span>
                  <span>
                    <span className="ar-title" style={{ display: "block" }}>
                      {c.title}
                      <span className={"badge " + pb.cls} style={{ marginLeft: 8 }}>{pb.label}</span>
                      {plan && plan.missedCount > 0 && <span className="badge badge-rejected" style={{ marginLeft: 6 }}>{plan.missedCount} missed</span>}
                      {locked && <span className="badge badge-muted" style={{ marginLeft: 6 }}>locked</span>}
                    </span>
                    <span className="ar-sub">
                      {/* Course code hidden for now: {c.code} */}
                      {plan && (plan.remaining > 0
                        ? `${rs(plan.remaining)} remaining${plan.nextDue ? `, next due ${fmtDate(plan.nextDue.due_date)}` : ""}`
                        : plan ? "fully paid" : "")}
                    </span>
                  </span>
                </button>
                {batchOptions.length > 0 && (
                  <SearchSelect style={{ flex: "0 0 150px" }} value={curBatch ? String(curBatch.id) : ""} placeholder="Set batch..." showAll={false}
                    options={batchOptions} onChange={(v) => moveBatch(cid, c, v)} />
                )}
                <button className={"btn btn-sm " + (locked ? "btn-outline" : "btn-ghost")} title={locked ? "Unlock access" : "Lock access (e.g. unpaid)"}
                  onClick={() => setCourseLock(id, cid, !locked)}>
                  {locked ? <><Unlock /> Unlock</> : <><Lock /> Lock</>}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleEnrol(email, cid)}><UserMinus /> Remove</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ENROL IN A COURSE</div>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <SearchSelect style={{ flex: "1 1 260px" }} value={sel} placeholder="Select a course..." showAll={false}
          emptyText="Enrolled in every course already."
          options={available.map(([cid, c]) => ({ value: cid, label: c.title }))}
          onChange={setSel} />
        <Button className="btn btn-primary" onClick={add} disabled={available.length === 0}><Plus /> Enrol</Button>
      </div>
    </div>
  );
}

function PaymentsTab({ id, s, store }) {
  const { courses, fetchStudentPlans } = store;
  const [plans, setPlans] = useState(null); // null = loading
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchStudentPlans(id).then((p) => { if (alive) setPlans(p); }).catch(() => { if (alive) setPlans([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const enrolled = s.enrolled.map((cid) => [cid, courses[cid]]).filter(([, c]) => c);
  const planByCourse = {};
  (plans || []).forEach((p) => { planByCourse[p.course_id] = p; });

  const apply = (r) => { if (r.ok) { setPlans(r.plans); setMsg(null); } else setMsg({ ok: false, text: r.msg }); };

  if (plans === null) return <p style={{ color: "#9CA3AF", fontSize: 13 }}>Loading...</p>;

  return (
    <div>
      <div className="card-subtitle" style={{ marginTop: 0 }}>The schedule for each course comes from that course's payment plan. Record what the student pays and it fills the registration fee and installments in order automatically.</div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}
      {enrolled.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>Enrol the student in a course first.</p>
      ) : (
        enrolled.map(([cid, c]) => (
          <PlanCard key={cid} course={c} plan={planByCourse[cid]} store={store} onApply={apply} />
        ))
      )}
    </div>
  );
}

function PaymentHistoryTab({ id, store }) {
  const { fetchStudentPlans } = store;
  const [plans, setPlans] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let alive = true;
    fetchStudentPlans(id).then((p) => { if (alive) setPlans(p); }).catch(() => { if (alive) setPlans([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (plans === null) return <p style={{ color: "#9CA3AF", fontSize: 13 }}>Loading...</p>;

  const log = [];
  for (const p of plans) for (const pay of p.payments) log.push({ ...pay, courseCode: p.courseCode, courseTitle: p.courseTitle });
  log.sort((a, b) => Number(b.paid_at) - Number(a.paid_at)); // newest first
  const totalPaid = log.reduce((n, x) => n + Number(x.amount), 0);

  const pageCount = Math.max(1, Math.ceil(log.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = log.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div>
      <div className="card-subtitle" style={{ marginTop: 0 }}>Every payment recorded for this student across all courses, newest first.</div>
      <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 12 }}>{log.length} payment{log.length === 1 ? "" : "s"} · {rs(totalPaid)} total</div>
      {log.length === 0 ? (
        <div className="empty-state"><div className="empty-icon"><Receipt /></div><p>No payments recorded yet.</p></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Course</th><th>Note</th><th>Amount</th></tr></thead>
              <tbody>
                {slice.map((pay) => (
                  <tr key={pay.id}>
                    <td style={{ color: "#6B7280", whiteSpace: "nowrap" }}>{fmtDate(new Date(Number(pay.paid_at)).toISOString().slice(0, 10))}</td>
                    <td style={{ color: "#6B7280" }}>{pay.courseTitle}</td>
                    <td style={{ color: "#6B7280" }}>{pay.note || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{rs(pay.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={log.length} />
        </>
      )}
    </div>
  );
}

/* Record-only view: the schedule comes from the course's payment plan (applied
   to enrolled students). The admin records payments here; the waterfall fills
   the registration fee and installments in order automatically. */
/* Allocate the flat payment pool across the schedule the same way the server
   does (a waterfall: fill each installment in order before money flows to the
   next). This lets each installment row show the exact payment line(s) that
   funded it. A single lump payment can span several installments, so it is
   split into "slices" that each keep the original payment id; deleting any
   slice removes the whole payment and the schedule reflows. Anything paid
   beyond the last installment (legacy overpayments) lands in `over`. */
function allocatePayments(installments, payments) {
  const cents = (v) => Math.round(Number(v) * 100);
  const rows = installments.map((it) => ({ inst: it, slices: [], remainC: cents(it.amount) }));
  const over = [];
  let ri = 0;
  for (const p of payments) {
    let leftC = cents(p.amount);
    while (leftC > 0 && ri < rows.length) {
      if (rows[ri].remainC <= 0) { ri++; continue; }
      const useC = Math.min(leftC, rows[ri].remainC);
      rows[ri].slices.push({ id: p.id, amount: useC / 100, note: p.note, paid_at: p.paid_at });
      rows[ri].remainC -= useC;
      leftC -= useC;
    }
    if (leftC > 0) over.push({ id: p.id, amount: leftC / 100, note: p.note, paid_at: p.paid_at });
  }
  return { rows, over };
}

function PlanCard({ course, plan, store, onApply }) {
  const { addPayment, removePayment } = store;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false); // accordion: collapsed by default

  const pay = async () => {
    setErr("");
    const amt = Number(amount);
    if (!(amt > 0)) { setErr("Enter a payment amount greater than zero."); return; }
    // Cap: a payment can never exceed what the student still owes for this course.
    if (plan && Math.round(amt * 100) > Math.round(plan.remaining * 100)) {
      await popup.alert(`That payment of ${rs(amt)} is more than the outstanding balance. This student still owes ${rs(plan.remaining)} (course fee ${rs(plan.total)}, already paid ${rs(plan.paid)}). Lower the amount, or delete a payment first.`,
        { title: "Payment too large", tone: "warning" });
      return;
    }
    const paidAt = paidDate ? new Date(paidDate + "T00:00:00").getTime() : Date.now();
    const r = await addPayment(plan.id, { amount: amt, note: note.trim(), paidAt });
    if (r.ok) { setAmount(""); setNote(""); setPaidDate(""); }
    onApply(r);
  };
  const delPay = async (payId) => onApply(await removePayment(payId));

  const pb = plan ? planBadge(plan.status) : null;
  const alloc = plan ? allocatePayments(plan.installments, plan.payments) : null;
  const dstr = (ms) => fmtDate(new Date(Number(ms)).toISOString().slice(0, 10));
  // Stack one line per payment-slice inside a cell, keeping every column's
  // lines the same height so the four payment columns stay aligned.
  const lines = (slices, render) => slices.length === 0
    ? <span style={{ color: "#C4C9D2" }}>-</span>
    : slices.map((s, i) => (
        <div key={`${s.id}-${i}`} title={typeof render(s) === "string" ? render(s) : undefined}
          style={{ height: 26, lineHeight: "26px", display: "flex", alignItems: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderTop: i ? "1px solid #EFF1F4" : "none", marginTop: i ? 5 : 0, paddingTop: i ? 5 : 0 }}>
          {render(s)}
        </div>
      ));

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
      {/* Accordion header: click to expand this course's schedule + payments. */}
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 14, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <ChevronRight style={{ width: 18, height: 18, color: "#9CA3AF", flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
          <span style={{ fontWeight: 700 }}>{course.title}</span>
          {plan && <span className={"badge " + pb.cls}>{pb.label}</span>}
          {plan && plan.missedCount > 0 && <span className="badge badge-rejected">{plan.missedCount} missed</span>}
        </span>
        <span style={{ fontSize: 12.5, color: "#9CA3AF", whiteSpace: "nowrap" }}>
          {plan ? `${rs(plan.paid)} paid · ${rs(plan.remaining)} left` : "No plan"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {!plan ? (
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>No payment plan for this course yet. Set it in the course's <strong>Payment plan</strong> tab and apply it; the schedule then appears here for recording payments.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span className="badge badge-accepted">Paid {rs(plan.paid)}</span>
                <span className={"badge " + (plan.remaining > 0 ? "badge-pending" : "badge-accepted")}>Remaining {rs(plan.remaining)}</span>
                <span className="badge badge-muted">Total {rs(plan.total)}</span>
              </div>

              {/* One table, one row per installment. Each row shows the payment
                  line(s) that funded it inside the Payment date / Note / Amount
                  cells; if an installment took two or more payments they stack
                  in the cell. Deleting a payment line removes that payment and
                  the schedule reflows (the installments themselves come from the
                  course plan and are never deleted here). */}
              <div className="table-wrap" style={{ marginBottom: 12 }}>
                <table>
                  <thead><tr><th>Installment</th><th>Amount</th><th>Due</th><th>Payment date</th><th>Note</th><th>Paid</th><th></th></tr></thead>
                  <tbody>
                    {alloc.rows.map(({ inst: it, slices }) => {
                      const ib = instBadge(it.status);
                      return (
                        <tr key={`i${it.id}`}>
                          <td style={{ verticalAlign: "top" }}>{it.label} <span className={"badge " + ib.cls} style={{ marginLeft: 4 }}>{ib.label}</span></td>
                          <td style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>{rs(it.amount)}</td>
                          <td style={{ color: "#6B7280", whiteSpace: "nowrap", verticalAlign: "top" }}>{fmtDate(it.due_date)}</td>
                          <td style={{ color: "#6B7280", whiteSpace: "nowrap", verticalAlign: "top" }}>{lines(slices, (s) => dstr(s.paid_at))}</td>
                          <td style={{ color: "#6B7280", verticalAlign: "top" }}>{lines(slices, (s) => s.note || "-")}</td>
                          <td style={{ fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{lines(slices, (s) => rs(s.amount))}</td>
                          <td style={{ textAlign: "right", verticalAlign: "top" }}>
                            {lines(slices, (s) => (
                              <button className="icon-btn-plain" title="Delete this payment (the schedule reflows automatically; it does not remove the installment)" onClick={() => delPay(s.id)}><Trash2 style={{ width: 16, height: 16 }} /></button>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                    {alloc.over.length > 0 && (
                      <tr>
                        <td style={{ color: "#B45309", fontStyle: "italic", verticalAlign: "top" }}>Unallocated (overpaid)</td>
                        <td style={{ verticalAlign: "top" }}></td>
                        <td style={{ verticalAlign: "top" }}></td>
                        <td style={{ color: "#6B7280", whiteSpace: "nowrap", verticalAlign: "top" }}>{lines(alloc.over, (s) => dstr(s.paid_at))}</td>
                        <td style={{ color: "#6B7280", verticalAlign: "top" }}>{lines(alloc.over, (s) => s.note || "-")}</td>
                        <td style={{ fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{lines(alloc.over, (s) => rs(s.amount))}</td>
                        <td style={{ textAlign: "right", verticalAlign: "top" }}>
                          {lines(alloc.over, (s) => (
                            <button className="icon-btn-plain" title="Delete this payment (the schedule reflows automatically)" onClick={() => delPay(s.id)}><Trash2 style={{ width: 16, height: 16 }} /></button>
                          ))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 6px" }}>RECORD A PAYMENT</div>
              <div className="card-subtitle" style={{ marginTop: 0 }}>Enter the amount received; it fills the registration fee and installments in order automatically.</div>
              <div className="toolbar" style={{ marginBottom: 0, alignItems: "flex-end" }}>
                <div className="tb-field" style={{ flex: "0 0 130px" }}>
                  <label className="form-label">Amount (Rs.)</label>
                  <input className="form-control" type="number" min="0" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(""); }} placeholder="5000" disabled={plan.remaining <= 0} />
                </div>
                <div className="tb-field" style={{ flex: "1 1 160px" }}>
                  <label className="form-label">Note</label>
                  <input className="form-control" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash / bank transfer" disabled={plan.remaining <= 0} />
                </div>
                <div className="tb-field" style={{ flex: "0 0 150px" }}>
                  <label className="form-label">Paid on</label>
                  <input className="form-control" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} disabled={plan.remaining <= 0} />
                </div>
                <Button className="btn btn-primary" onClick={pay} disabled={plan.remaining <= 0}><Plus /> Add payment</Button>
              </div>
              {plan.remaining <= 0
                ? <div style={{ fontSize: 12, color: "#16A34A", marginTop: 6, fontWeight: 600 }}>Fully paid - nothing more to record.</div>
                : err && <div className="field-error" style={{ marginTop: 6 }}>{err}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
