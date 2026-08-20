import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Users, PlayCircle, Link2, FileDown, Save, Trash2, Plus, X,
  CheckCircle, AlertTriangle, Presentation, Settings as SettingsIcon, Search, UserPlus, UserMinus, Eye, EyeOff, GripVertical, Upload, Wallet, Pencil, Check, Layers,
  Award, Send, Download, LockOpen, Calendar,
} from "lucide-react";

// "Batch 2 · ongoing" style label for the batch dropdown / cards.
function batchLabel(b) {
  if (!b) return "";
  const dates = [b.start_date, b.end_date].filter(Boolean).join(" to ");
  return `Batch ${b.number}${b.status === "ended" ? " (ended)" : ""}${dates ? " · " + dates : ""}`;
}
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import { popup } from "../../components/Popup.jsx";
import Button from "../../components/Button.jsx";
import RichTextEditor from "../../components/RichTextEditor.jsx";
import { useStore } from "../../state.jsx";
import { rs, fmtDate, fmtDateMs, planBadge, installmentBuckets } from "../../lib/payments.js";

function BatchDatesEditor({ batch, courseId, setBatchDates, onDone }) {
  const [number, setNumber] = useState(String(batch.number ?? ""));
  const [startDate, setStartDate] = useState(batch.start_date || "");
  const [endDate, setEndDate] = useState(batch.end_date || "");
  const [certDate, setCertDate] = useState(batch.cert_date || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await setBatchDates(courseId, batch.id, { number: Number(number), startDate, endDate, certDate });
    setBusy(false);
    if (r.ok) { popup.toast("Batch details saved."); onDone(); }
    else setMsg(r.msg || "Could not save batch details.");
  };

  return (
    <div className="card" style={{ marginTop: 12, maxWidth: 700 }}>
      <div className="card-title">Batch {batch.number} details</div>
      <div className="card-subtitle">The certificate date prints on every certificate issued for this batch (e.g. a graduation date). Leave it blank to print each certificate's actual issue date instead.</div>
      {msg && <div className="alert alert-danger"><AlertTriangle /> {msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
        <div className="form-group"><label className="form-label">Batch number</label>
          <input className="form-control" type="number" min="1" step="1" value={number} onChange={(e) => setNumber(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Start date</label>
          <input className="form-control" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">End date</label>
          <input className="form-control" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>Saving this batch's payment plan replaces this with the plan's completion date.</div></div>
        <div className="form-group"><label className="form-label">Certificate date</label>
          <input className="form-control" type="date" value={certDate} onChange={(e) => setCertDate(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button className="btn btn-primary" loading={busy} onClick={save}><Save /> Save changes</Button>
        <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

export default function CourseManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useStore();
  const { courses, users, certificates, fetchCourseBatch, startNewBatch, setBatchDates } = store;
  const c = courses[id];
  const [tab, setTab] = useState("details"); // open on Course details (first tab)
  const [viewBatchId, setViewBatchId] = useState(null); // null = current
  const [bc, setBc] = useState(null);                   // viewed batch's content/instructors
  const [batchBusy, setBatchBusy] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);

  const batches = c ? (c.batches || []) : [];
  const activeBatchId = viewBatchId || (c && c.batchId);
  const viewedBatch = batches.find((b) => b.id === activeBatchId) || null;

  // Load the viewed batch's content/instructors/plan; refreshed after mutations.
  const reload = useCallback(async () => {
    if (!c || !activeBatchId) return;
    try { setBc(await fetchCourseBatch(id, activeBatchId)); } catch { /* keep last */ }
  }, [id, activeBatchId, c, fetchCourseBatch]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { window.scrollTo(0, 0); }, [tab]); // each tab starts at the top

  if (!c) return <Navigate to="/admin/courses" replace />;

  // Data for the viewed batch (falls back to the store's current-batch course until fetched).
  const data = bc && bc.batchId === activeBatchId ? bc : c;
  const viewedNum = viewedBatch ? viewedBatch.number : null;
  const inBatch = (u) => u.enrolled.includes(id) && (u.enrolledBatch ? u.enrolledBatch[id] === viewedNum : true);
  const enrolledCount = Object.values(users).filter(inBatch).length;
  // Certificates issued for this course in the viewed batch only.
  const issuedCount = (certificates || []).filter((c) => c.course_id === id && (viewedNum == null || c.batchNumber === viewedNum)).length;

  const tabs = [
    { k: "details", label: "Course details", icon: SettingsIcon },
    { k: "plan", label: "Payment plan", icon: Wallet },
    { k: "students", label: "Enrolled students", icon: Users, n: enrolledCount },
    { k: "instructor", label: "Instructors", icon: Presentation, n: data.instructors.length },
    { k: "recordings", label: "Recordings", icon: PlayCircle, n: data.recordings.length },
    { k: "links", label: "Course links", icon: Link2, n: data.links.length },
    { k: "materials", label: "Materials", icon: FileDown, n: data.materials.length },
    { k: "certificates", label: "Certificates", icon: Award, n: issuedCount },
  ];

  const onStartNewBatch = async () => {
    const nextNum = batches.length ? Math.max(...batches.map((b) => b.number)) + 1 : 1;
    const input = await popup.prompt(
      "The current batch is ended, and its instructors, content, and payment plan are copied into the new batch (students are not copied). Enter the batch number for the new batch:",
      String(nextNum),
      { title: "Start new batch", confirmText: "Start new batch", placeholder: "Batch number" }
    );
    if (input === null) return; // cancelled
    const num = parseInt(String(input).trim(), 10);
    if (!Number.isInteger(num) || num < 1) { popup.toast("Enter a valid batch number.", "error"); return; }
    setBatchBusy(true);
    const r = await startNewBatch(id, { number: num });
    setBatchBusy(false);
    if (r.ok) { setViewBatchId(null); popup.toast(`Batch ${num} started`); } // jump to the new ongoing batch
    else popup.toast(r.msg || "Could not start the batch.", "error");
  };

  return (
    <Layout title="Manage course">
      <button className="back-link" onClick={() => navigate("/admin/courses")}><ArrowLeft /> All courses</button>

      <div className="page-hero">
        {/* Course code hidden for now: <div className="ph-code">{c.code}</div> */}
        <h1>{c.title}</h1>
        <p>{data.instructor ? `Instructor: ${data.instructor}` : "No instructor assigned"}</p>
        <div className="batch-bar">
          <Layers style={{ width: 16, height: 16, color: "var(--primary)" }} />
          <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>Batch</span>
          <select className="form-control" style={{ flex: "0 0 auto", width: "auto", maxWidth: 280 }}
            value={activeBatchId || ""} onChange={(e) => setViewBatchId(Number(e.target.value))}>
            {batches.map((b) => <option key={b.id} value={b.id}>{batchLabel(b)}</option>)}
          </select>
          <Button className="btn btn-outline" loading={batchBusy} onClick={onStartNewBatch}><Plus /> Start new batch</Button>
          <button className="btn btn-outline" type="button" onClick={() => setDatesOpen((v) => !v)}><Calendar /> {datesOpen ? "Close dates" : "Edit dates"}</button>
        </div>
        {datesOpen && viewedBatch && (
          <BatchDatesEditor key={viewedBatch.id} batch={viewedBatch} courseId={id} setBatchDates={setBatchDates} onDone={() => setDatesOpen(false)} />
        )}
      </div>

      <div className="stats-grid">
        <Stat label="Batches" value={batches.length} icon={Layers} bg="#F5F3FF" color="#7C3AED" />
        <Stat label="Enrolled" value={enrolledCount} icon={Users} bg="#EBF2FF" color="#1E509B" />
        <Stat label="Recordings" value={data.recordings.length} icon={PlayCircle} bg="#EFF6FF" color="#2563EB" />
        <Stat label="Links" value={data.links.length} icon={Link2} bg="#F0FDF4" color="#16A34A" />
        <Stat label="Materials" value={data.materials.length} icon={FileDown} bg="#FFFBEB" color="#D97706" />
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> <span className="tab-label">{t.label}</span>{t.n != null && <span className="tab-count">{t.n}</span>}
            </button>
          ))}
        </div>

        {tab === "details" && <DetailsTab id={id} c={c} store={store} navigate={navigate} />}
        {tab === "recordings" && <ContentSection id={id} batchId={activeBatchId} reload={reload} store={store} bucket="recordings" title="Recordings" Icon={PlayCircle} items={data.recordings} placeholder="Recording title" installments={data.planInstallments} />}
        {tab === "links" && <ContentSection id={id} batchId={activeBatchId} reload={reload} store={store} bucket="links" title="Course links" Icon={Link2} items={data.links} placeholder="Link title" installments={data.planInstallments} />}
        {tab === "materials" && <ContentSection id={id} batchId={activeBatchId} reload={reload} store={store} bucket="materials" title="Materials" Icon={FileDown} items={data.materials} placeholder="Material title" installments={data.planInstallments} />}
        {tab === "students" && <StudentsTab id={id} batchId={activeBatchId} batchNum={viewedNum} store={store} navigate={navigate} />}
        {tab === "certificates" && <CertificatesTab id={id} batchNum={viewedNum} courseTitle={c.title} certProgramName={c.certProgramName} store={store} />}
        {tab === "plan" && <CoursePlanTab id={id} batchId={activeBatchId} batchNum={viewedNum} store={store} />}
        {tab === "instructor" && <InstructorTab id={id} batchId={activeBatchId} c={data} reload={reload} store={store} navigate={navigate} />}
      </div>
    </Layout>
  );
}

function DetailsTab({ id, c, store, navigate }) {
  const [code, setCode] = useState(c.code);
  const [title, setTitle] = useState(c.title);
  const [blurb, setBlurb] = useState(c.blurb || "");
  const [certTemplate, setCertTemplate] = useState(c.certTemplate || "");
  const [certProgramName, setCertProgramName] = useState(c.certProgramName || "");
  const [certSubtitle, setCertSubtitle] = useState(c.certSubtitle || "");
  const [templates, setTemplates] = useState([]);
  const [defaultId, setDefaultId] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    store.fetchCertTemplates()
      .then((d) => { if (alive) { setTemplates(d.templates || []); setDefaultId(d.defaultId || ""); } })
      .catch(() => { /* selector just stays empty */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultName = templates.find((t) => t.id === defaultId)?.name || "default";
  // A previously-saved template id may no longer exist; fall back to the default.
  const knownTemplate = templates.length === 0 || templates.some((t) => t.id === certTemplate);
  const certValue = knownTemplate ? certTemplate : "";
  const preview = async () => {
    const tid = certValue || defaultId;
    if (tid) { try { await store.previewCertTemplate(tid, { courseTitle: title, certProgramName, certSubtitle }); } catch (e) { setMsg({ ok: false, msg: e.message }); } }
  };

  const save = async () => setMsg(await store.updateCourse(id, { code, title, sessions: c.sessions ?? 0, blurb, certTemplate: certValue, certProgramName, certSubtitle }));
  const remove = async () => {
    if (!(await popup.confirm(`Delete "${c.title}"? This removes its content and enrolments. This cannot be undone.`, { title: "Delete course", confirmText: "Delete", danger: true }))) return;
    await store.deleteCourse(id);
    navigate("/admin/courses");
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="alert alert-info" style={{ marginBottom: 18 }}><Layers /> <span>These details (title, description, certificate template) are shared across all batches of this course. Per-batch setup lives in the other tabs.</span></div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
      {/* Course code hidden for now (preserved on save via the `code` state):
      <div className="form-group"><label className="form-label">Code</label>
        <input className="form-control" value={code} onChange={(e) => setCode(e.target.value)} /></div>
      */}
      <div className="form-group"><label className="form-label">Title</label>
        <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Description</label>
        <RichTextEditor value={blurb} onChange={setBlurb} placeholder="Describe what this course covers. Use the toolbar for bold, lists, and links..." /></div>
      <div className="form-group"><label className="form-label">Certificate template</label>
        <div style={{ display: "flex", gap: 10 }}>
          <select className="form-control" style={{ maxWidth: 300 }} value={certValue} onChange={(e) => setCertTemplate(e.target.value)}>
            <option value="">Default ({defaultName})</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn-outline" type="button" onClick={preview}><Eye /> Preview</button>
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>Used for every certificate issued for this course. The default is locked in automatically on first issue.</div>
      </div>
      <div className="form-group"><label className="form-label">Certificate program name <span style={{ color: "#EF4444" }}>*</span></label>
        <input className="form-control" value={certProgramName} placeholder="e.g. Stock Market Certificate Program" onChange={(e) => setCertProgramName(e.target.value)} />
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>The course title printed on the certificate. Required - certificates cannot be issued for this course until this is set.</div>
      </div>
      <div className="form-group"><label className="form-label">Certificate subject line</label>
        <input className="form-control" value={certSubtitle} placeholder="In Stock Market Investments" onChange={(e) => setCertSubtitle(e.target.value)} />
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>The smaller line under the certificate heading. Leave it blank to keep the wording built into the template ("In Stock Market Investments").</div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button className="btn btn-primary" onClick={save}><Save /> Save changes</Button>
        <Button className="btn btn-danger" onClick={remove}><Trash2 /> Delete course</Button>
      </div>
    </div>
  );
}

function StudentsTab({ id, batchId, batchNum, store, navigate }) {
  const { users, plans } = store;
  const planByUser = {};
  (plans || []).forEach((p) => { if (p.course_id === id) planByUser[p.user_id] = p; });
  const [qy, setQy] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const inThisBatch = (s) => s.enrolled.includes(id) && (s.enrolledBatch ? s.enrolledBatch[id] === batchNum : true);
  const inCourse = (s) => s.enrolled.includes(id);
  const otherBatch = (s) => (inCourse(s) && !inThisBatch(s) ? (s.enrolledBatch ? s.enrolledBatch[id] : null) : null);
  const ql = qy.trim().toLowerCase();
  const all = Object.entries(users).filter(([, u]) => u.role === "student");
  const enrolledCount = all.filter(([, s]) => inThisBatch(s)).length;

  // Always scoped to the viewed batch; the enrolment dropdown was removed.
  const filtered = all
    .filter(([, s]) => inThisBatch(s))
    .filter(([, s]) => status === "all" || s.status === status)
    .filter(([email, s]) => !ql || s.name.toLowerCase().includes(ql) || email.toLowerCase().includes(ql) || (s.username || "").toLowerCase().includes(ql));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const resetPage = () => setPage(1);
  const activeFilters = (status !== "all") + (ql ? 1 : 0);

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
          <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search by full name or email"
            value={qy} onChange={(e) => { setQy(e.target.value); resetPage(); }} />
        </div>
        <select className="form-control" style={{ flex: "0 0 150px" }} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="invited">Invited</option>
        </select>
        {activeFilters > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setStatus("all"); resetPage(); }}><X /> Clear</button>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 12 }}>{enrolledCount} enrolled in Batch {batchNum} · {filtered.length} of {all.length} students shown</div>

      {filtered.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>No students match.</p>
      ) : (
        <>
          {slice.map(([email, s]) => {
            const isEnrolled = inThisBatch(s);
            const inOther = otherBatch(s);
            const plan = planByUser[s.id];
            const pb = isEnrolled ? planBadge(plan ? plan.status : "empty") : null;
            return (
              <div key={email} className="assigned-row">
                <div className="ar-body">
                  <div className="ar-title">
                    {s.name}
                    {isEnrolled && <span className="badge badge-accepted" style={{ marginLeft: 6 }}>in Batch {batchNum}</span>}
                    {inOther != null && <span className="badge badge-muted" style={{ marginLeft: 6 }}>in Batch {inOther}</span>}
                    <span className={"badge " + (s.status === "active" ? "badge-accepted" : "badge-pending")} style={{ marginLeft: 6 }}>{s.status}</span>
                    {pb && <span className={"badge " + pb.cls} style={{ marginLeft: 6 }}>{pb.label}</span>}
                    {isEnrolled && plan && plan.missedCount > 0 && <span className="badge badge-rejected" style={{ marginLeft: 6 }}>{plan.missedCount} missed</span>}
                  </div>
                  <div className="ar-sub">
                    {s.email}{s.phone ? ` · ${s.phone}` : ""}
                    {isEnrolled && plan && (plan.remaining > 0
                      ? ` · ${rs(plan.remaining)} remaining${plan.nextDue ? `, next due ${fmtDate(plan.nextDue.due_date)}` : ""}`
                      : "")}
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/students/${s.id}`)}><Eye /> View</button>
              </div>
            );
          })}
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={filtered.length} />
        </>
      )}
    </>
  );
}

function fmtCertDate(ts) { return fmtDateMs(Number(ts) || Date.now()); }

// The same reading the automatic issue uses: no plan means nothing to settle.
const feesSettled = (plan) => !plan || Number(plan.remaining || 0) <= 0.009;

/* What is still holding a certificate up, in one sub-line. Long exam lists are
   summarised so the row never wraps. Empty when nothing is outstanding. */
function outstandingNote(gate, plan) {
  const bits = [];
  const titles = gate.known ? gate.pending.map((p) => p.title) : [];
  if (titles.length > 0) {
    bits.push("Not completed: " + (titles.length > 2 ? `${titles.slice(0, 2).join(", ")} +${titles.length - 2} more` : titles.join(", ")));
  }
  if (!feesSettled(plan)) bits.push(`${rs(plan.remaining)} remaining`);
  return bits.join(" · ");
}

/* Watch and, in exceptional cases, override certificates for THIS course and
   THIS batch. Issuing is automatic, so the manual tick list stays scoped to the
   viewed batch: that is what stops an accidental "issue to everyone". */
function CertificatesTab({ id, batchNum, courseTitle, certProgramName, store }) {
  const { users, certificates, exams, plans, loadExam, issueManyCertificates, unlockCertificate, sendCertificate, adminViewCertificate, adminDownloadCertificate } = store;
  const [statusF, setStatusF] = useState("all");
  const [qy, setQy] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const batchTag = batchNum != null ? `Batch ${batchNum}` : "this course";

  // Same rule the server gates on: an exam attached to this course counts only
  // while it holds questions, so an empty paper never blocks a certificate.
  const gating = (exams || []).filter((e) => e.course_id === id && Number(e.bankSize) > 0);
  const gatingKey = gating.map((e) => e.id).join(",");
  // examId -> ids of the students who have finished it. null until it loads,
  // which is the only time a row cannot report where the student stands.
  const [finished, setFinished] = useState(null);
  const [examErr, setExamErr] = useState(false);

  useEffect(() => {
    const ids = gatingKey ? gatingKey.split(",").map(Number) : [];
    let alive = true;
    setExamErr(false);
    if (ids.length === 0) { setFinished(new Map()); return undefined; }
    setFinished(null);
    Promise.all(ids.map((eid) => loadExam(eid)))
      .then((list) => {
        if (!alive) return;
        const m = new Map();
        list.forEach((ex, i) => m.set(ids[i], new Set((ex.attempts || []).map((a) => a.user_id))));
        setFinished(m);
      })
      .catch(() => { if (alive) setExamErr(true); });
    return () => { alive = false; };
  }, [gatingKey, loadExam]);

  const planByUser = {};
  (plans || []).forEach((p) => { if (p.course_id === id) planByUser[p.user_id] = p; });

  // One row per student enrolled in THIS course's viewed batch, plus any
  // certificate already issued for this course+batch (in case a student moved).
  const rows = [];
  const seen = new Set();
  for (const u of Object.values(users)) {
    if (u.role !== "student" || !u.enrolled.includes(id)) continue;
    const stuBatch = u.enrolledBatch ? u.enrolledBatch[id] : null;
    if (batchNum != null && stuBatch !== batchNum) continue;
    const cert = certificates.find((c) => c.student_id === u.id && c.course_id === id) || null;
    rows.push({ key: String(u.id), studentId: u.id, name: u.name, email: u.email, batchNumber: stuBatch, cert, blocked: (u.certBlockedCourses || []).includes(id) });
    seen.add(String(u.id));
  }
  for (const c of certificates) {
    if (c.course_id !== id || (batchNum != null && c.batchNumber !== batchNum) || seen.has(String(c.student_id))) continue;
    rows.push({ key: String(c.student_id), studentId: c.student_id, name: c.studentName, email: c.studentEmail, batchNumber: c.batchNumber, cert: c, blocked: !!c.certBlocked });
  }

  const ql = qy.trim().toLowerCase();
  const filtered = rows
    .filter((r) => statusF === "all" || (statusF === "issued" ? r.cert : !r.cert))
    .filter((r) => !ql || r.name.toLowerCase().includes(ql) || (r.email || "").toLowerCase().includes(ql));

  const selectableKeys = filtered.filter((r) => !r.cert).map((r) => r.key);
  const allChecked = selectableKeys.length > 0 && selectableKeys.every((k) => selected.has(k));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const reset = () => setPage(1);

  const toggle = (k) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allChecked) selectableKeys.forEach((k) => n.delete(k)); else selectableKeys.forEach((k) => n.add(k));
    return n;
  });

  const missingProgramName = !certProgramName || !certProgramName.trim();

  // Exam progress for one row. An issued certificate carries the server's own
  // reading of the gate; every other row is measured against the same exams here.
  const examGate = (r) => {
    if (r.cert) return { known: true, required: Number(r.cert.examRequired) || 0, pending: r.cert.examPending || [], ok: !!r.cert.examOk };
    if (gating.length === 0) return { known: true, required: 0, pending: [], ok: true };
    if (!finished) return { known: false, required: gating.length, pending: [], ok: false };
    const pending = gating.filter((e) => { const done = finished.get(e.id); return !done || !done.has(r.studentId); });
    return { known: true, required: gating.length, pending, ok: pending.length === 0 };
  };
  const clear = (r) => !r.blocked && examGate(r).ok && feesSettled(planByUser[r.studentId]);

  const issue = async () => {
    if (missingProgramName) { setMsg({ ok: false, msg: "Set a Certificate program name on the Course details tab before issuing certificates." }); return; }
    const picked = filtered.filter((r) => !r.cert && selected.has(r.key));
    if (picked.length === 0) { setMsg({ ok: false, msg: "Tick at least one student to certify." }); return; }
    const held = picked.filter((r) => !clear(r));
    const lines = [`Issue ${picked.length} certificate${picked.length === 1 ? "" : "s"} for "${courseTitle}" (${batchTag})? Each selected student gets a certificate for this course and an email. This only affects the students ticked below.`];
    if (held.length > 0) {
      lines.push("", `${held.length} of them ${held.length === 1 ? "has" : "have"} exams or fees outstanding, or a certificate on hold. Issuing by hand creates the certificate, but the student still cannot download it while any exam is incomplete, the fees are outstanding, or the hold stands.`);
    }
    if (!(await popup.confirm(lines.join("\n"), { title: "Issue certificates", confirmText: `Issue ${picked.length}` }))) return;
    const r = await issueManyCertificates(picked.map((r2) => ({ studentId: r2.studentId, courseId: id })));
    setMsg(r);
    if (r.ok) setSelected(new Set());
  };

  const act = async (fn) => { try { const r = await fn(); if (r) setMsg(r); } catch (e) { setMsg({ ok: false, msg: e.message }); } };
  const statusBadge = (cert) => {
    if (!cert) return <span className="badge badge-pending">Not issued</span>;
    if (cert.unlocked) return <span className="badge badge-verify">Unlocked</span>;
    if (cert.downloaded) return <span className="badge badge-muted">Downloaded</span>;
    return <span className="badge badge-accepted">Available</span>;
  };
  // Has the student completed every gating exam? Nothing to show while the course
  // has no gating exam, or until the attempts load.
  const examBadge = (gate) => {
    if (!gate.known || gate.required === 0) return null;
    return gate.ok
      ? <span className="badge badge-accepted">Exams completed</span>
      : <span className="badge badge-pending">Exams pending</span>;
  };
  // The line under the certificate badge: when it was issued, or what the
  // automatic issue is waiting for.
  const certNote = (r) => {
    if (r.cert) return `Issued ${fmtCertDate(r.cert.issued_at)}`;
    if (r.blocked) return "Withheld by an admin";
    if (clear(r)) return missingProgramName ? "Waiting on the Certificate program name" : "Issues by itself at this student's next sign in";
    return "";
  };

  return (
    <div>
      <div className="alert alert-info" style={{ marginTop: 0, marginBottom: 14 }}><Award /> <span>Certificates appear on their own, with no email sent, once a student has completed the course exams and settled their fees, so there is normally nothing to do here. Issuing by hand creates the record early and emails the student, but they still cannot download it until both are done. It covers <strong>{batchTag}</strong> only: switch the batch selector above for another batch.</span></div>
      {missingProgramName && (
        <div className="alert alert-danger" style={{ marginBottom: 14 }}><AlertTriangle /> <span>No Certificate program name is set for this course. Set one on the Course details tab before any certificate for this course can be issued, automatically or by hand.</span></div>
      )}
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <select className="form-control" style={{ flex: "0 0 150px" }} value={statusF} onChange={(e) => { setStatusF(e.target.value); reset(); }}>
          <option value="all">All statuses</option>
          <option value="issued">Issued</option>
          <option value="notissued">Not issued</option>
        </select>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
          <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search student name or email" value={qy} onChange={(e) => { setQy(e.target.value); reset(); }} />
        </div>
        <Button className="btn btn-outline" style={{ marginLeft: "auto" }} onClick={issue} disabled={selected.size === 0 || missingProgramName}>
          <Award /> Issue {selected.size > 0 ? `${selected.size} ` : ""}by hand
        </Button>
      </div>
      <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>
        {filtered.length} student{filtered.length === 1 ? "" : "s"} in {batchTag}
        {gating.length > 0
          ? ` · Exams checked: ${gating.map((e) => e.title).join(", ")}`
          : " · No exam is attached to this course, so only the fees are checked"}
        {examErr ? " · exam progress could not be loaded, reload to try again" : ""}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-icon"><Award /></div><p>No students in {batchTag} match these filters.</p></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: "center" }}>
                    <input type="checkbox" checked={allChecked} disabled={selectableKeys.length === 0} onChange={toggleAll}
                      style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: selectableKeys.length ? "pointer" : "default" }} />
                  </th>
                  <th>Student</th><th>Batch</th><th>Exams and fees</th><th>Certificate</th><th></th>
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => {
                  const plan = planByUser[r.studentId] || null;
                  const pb = planBadge(plan ? plan.status : "empty");
                  const gate = examGate(r);
                  const waiting = outstandingNote(gate, plan);
                  const note = certNote(r);
                  return (
                    <tr key={r.key}>
                      <td style={{ textAlign: "center" }}>
                        {r.cert
                          ? <CheckCircle style={{ width: 15, height: 15, color: "#16A34A" }} />
                          : <input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer" }} />}
                      </td>
                      <td><div style={{ fontWeight: 700, color: "var(--title)" }}>{r.name}</div><div style={{ fontSize: 12, color: "#9CA3AF" }}>{r.email}</div></td>
                      <td style={{ color: "#6B7280", whiteSpace: "nowrap" }}>{r.batchNumber != null ? `Batch ${r.batchNumber}` : "-"}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{examBadge(gate)}<span className={"badge " + pb.cls}>{pb.label}</span></div>
                        {waiting ? <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{waiting}</div> : null}
                      </td>
                      <td>
                        {statusBadge(r.cert)}
                        {r.blocked ? <span className="badge badge-pending" style={{ marginLeft: 6 }}>Certificate on hold</span> : null}
                        {r.cert && r.cert.redownload_requested ? <span className="badge badge-pending" style={{ marginLeft: 6 }}>Re-download requested</span> : null}
                        {note ? <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{note}</div> : null}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {r.cert && <>
                          <button className="icon-btn-plain" title="View" onClick={() => act(() => adminViewCertificate(r.cert.id))}><Eye style={{ width: 16, height: 16 }} /></button>
                          <button className="icon-btn-plain" title="Download" onClick={() => act(() => adminDownloadCertificate(r.cert.id, r.cert.cert_no))}><Download style={{ width: 16, height: 16 }} /></button>
                          <button className="icon-btn-plain" title="Email to student" onClick={() => act(() => sendCertificate(r.cert.id))}><Send style={{ width: 16, height: 16 }} /></button>
                          {r.cert.downloaded && !r.cert.unlocked && (
                            <button className="icon-btn-plain" title="Unlock one re-download" onClick={() => unlockCertificate(r.cert.id)} style={{ color: "var(--primary)" }}><LockOpen style={{ width: 16, height: 16 }} /></button>
                          )}
                        </>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={filtered.length} />
        </>
      )}
    </div>
  );
}

// An edited due date must stay within the plan's own first-payment/start date
// and its "Complete all payments by" date (whichever bounds are actually set).
function dueDateOutOfRange(date, startDate, completionDate) {
  if (!date) return null;
  if (startDate && date < startDate) return `Can't be before the start date (${fmtDate(startDate)}).`;
  if (completionDate && date > completionDate) return `Can't be after "Complete all payments by" (${fmtDate(completionDate)}).`;
  return null;
}

function CoursePlanTab({ id, batchId, batchNum, store }) {
  const batchLabel = batchNum != null ? `Batch ${batchNum}` : "this batch";
  const { fetchCoursePlan, saveCoursePlan, applyCoursePlan } = store;
  const [plan, setPlan] = useState(null);
  const [preview, setPreview] = useState([]);
  const [dueDates, setDueDates] = useState({}); // { label: "YYYY-MM-DD" } row overrides, staged until Save
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const blank = { total_fee: 0, reg_fee: 0, installments: 0, start_date: "", completion_date: "", exam_unlock: -1, due_dates: {} };
    setPlan(null);
    fetchCoursePlan(id, batchId)
      .then((d) => { if (alive) { setPlan(d.plan || blank); setPreview(d.preview || []); setDueDates((d.plan || blank).due_dates || {}); } })
      .catch(() => { if (alive) setPlan(blank); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, batchId]);

  if (!plan) return <p style={{ color: "#9CA3AF", fontSize: 13 }}>Loading...</p>;

  const set = (k) => (e) => setPlan((p) => ({ ...p, [k]: e.target.value }));
  const setDueDate = (label, value) => setDueDates((d) => ({ ...d, [label]: value }));
  const rowErrors = preview.reduce((acc, it) => {
    const err = dueDateOutOfRange(dueDates[it.label] ?? it.dueDate, plan.start_date, plan.completion_date);
    if (err) acc[it.label] = err;
    return acc;
  }, {});
  const hasRowErrors = Object.keys(rowErrors).length > 0;

  // Save the template and immediately apply it to every enrolled student, so
  // each student follows the course plan with no per-student setup.
  const saveAndApply = async () => {
    if (hasRowErrors) { setMsg({ ok: false, text: "Fix the schedule due-date errors below before saving." }); return; }
    setBusy(true); setMsg(null);
    const r = await saveCoursePlan(id, batchId, { ...plan, dueDates });
    if (!r.ok) { setBusy(false); setMsg({ ok: false, text: r.msg }); return; }
    setPlan(r.plan); setPreview(r.preview || []); setDueDates(r.plan.due_dates || {});
    const a = await applyCoursePlan(id, batchId);
    setBusy(false);
    setMsg(a.ok
      ? { ok: true, text: `Saved for ${batchLabel} and applied to ${a.applied} student${a.applied === 1 ? "" : "s"} in this batch. New enrolments in this batch get it automatically.` }
      : { ok: false, text: `Saved, but applying failed: ${a.msg}` });
  };

  const previewTotal = preview.reduce((n, x) => n + Number(x.amount || 0), 0);
  // Exam-unlock options derived from this batch's plan. Registration fees are
  // no longer taken, so there is no "after registration fee" stage anymore.
  const examOpts = [
    { v: -1, label: "After full payment (all installments)" },
    { v: 0, label: "Available to everyone (no payment needed)" },
    ...Array.from({ length: Math.max(0, Math.min(36, Number(plan.installments) || 0)) }, (_, i) => ({ v: i + 2, label: `After Installment ${i + 1}` })),
  ];

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="alert alert-info" style={{ marginTop: 0, marginBottom: 14 }}><Wallet /> <span>This fee is for <strong>{batchLabel}</strong> only. Each batch has its own fee; other batches are not affected. Use the batch selector above to set a different fee for another batch.</span></div>
      <div className="card-subtitle" style={{ marginTop: 0 }}>Saving applies it to every student enrolled in {batchLabel}, and anyone who enrols in this batch later follows it automatically. You then record each student's payments on their own Payments tab.</div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}

      <div className="form-group"><label className="form-label">Total fee (Rs.)</label>
        <input className="form-control" type="number" min="0" value={plan.total_fee} onChange={set("total_fee")} placeholder="45000" /></div>
      <div className="form-group"><label className="form-label">Number of installments</label>
        <input className="form-control" type="number" min="0" max="36" value={plan.installments} onChange={set("installments")} placeholder="4" /></div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">First payment / start date</label>
          <input className="form-control" type="date" value={plan.start_date} onChange={set("start_date")} /></div>
        <div className="form-group"><label className="form-label">Complete all payments by <span className="req">*</span></label>
          <input className="form-control" type="date" value={plan.completion_date} onChange={set("completion_date")} /></div>
      </div>

      <div className="form-group"><label className="form-label">Unlock exams</label>
        <select className="form-control" value={plan.exam_unlock ?? -1} onChange={(e) => setPlan((p) => ({ ...p, exam_unlock: Number(e.target.value) }))}>
          {examOpts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>By default students must finish all payments before they can write exams. Choose "everyone" to allow exams without payment, or unlock from an earlier installment. This setting is for {batchLabel} only.</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <Button className="btn btn-primary" loading={busy} disabled={hasRowErrors} onClick={saveAndApply}><Save /> Save & apply to {batchLabel} students</Button>
      </div>

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>SCHEDULE PREVIEW (SAVED)</div>
      {preview.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>Enter a fee, installment count and dates, then Save to preview the schedule.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Line</th><th>Amount</th><th>Due</th></tr></thead>
              <tbody>
                {preview.map((it, i) => {
                  const value = dueDates[it.label] ?? it.dueDate;
                  const err = rowErrors[it.label];
                  return (
                    <tr key={i}>
                      <td>{it.label}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{rs(it.amount)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <Calendar style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9CA3AF", pointerEvents: "none" }} />
                          <input type="date" className="form-control" style={{ paddingLeft: 28, width: 165 }}
                            value={value} onChange={(e) => setDueDate(it.label, e.target.value)} />
                        </div>
                        {err && <div style={{ color: "#DC2626", fontSize: 11.5, marginTop: 4 }}>{err}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 8 }}>Total of lines: {rs(previewTotal)}</div>
        </>
      )}
    </div>
  );
}

function InstructorTab({ id, batchId, c, reload, store, navigate }) {
  const { instructors, addCourseInstructor, removeCourseInstructor } = store;
  const add = async (iid) => { await addCourseInstructor(id, batchId, iid); await reload(); };
  const remove = async (iid) => { await removeCourseInstructor(id, batchId, iid); await reload(); };
  const [qy, setQy] = useState("");
  const assignedIds = c.instructors.map((i) => i.id);
  const ql = qy.trim().toLowerCase();
  const available = instructors
    .filter((i) => !assignedIds.includes(i.id))
    .filter((i) => !ql || i.name.toLowerCase().includes(ql) || (i.title || "").toLowerCase().includes(ql) || (i.email || "").toLowerCase().includes(ql));

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ASSIGNED ({c.instructors.length})</div>
      {c.instructors.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 18 }}>No instructors assigned yet.</p> : (
        <div style={{ marginBottom: 22 }}>
          {c.instructors.map((i) => (
            <div key={i.id} className="assigned-row">
              <button className="ar-body" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                onClick={() => navigate(`/admin/instructors/${i.id}`)}>
                <span className="mr-icon" style={{ width: 34, height: 34 }}><Presentation /></span>
                <span>
                  <span className="ar-title" style={{ display: "block" }}>{i.name}</span>
                  {i.title && <span className="ar-sub">{i.title}</span>}
                </span>
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/instructors/${i.id}`)}><Eye /> View</button>
              <Button className="btn btn-ghost btn-sm" onClick={() => remove(i.id)}><UserMinus /> Remove</Button>
            </div>
          ))}
        </div>
      )}

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ADD INSTRUCTOR</div>
      {instructors.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>No instructors exist yet. Create them in the Instructors section.</p>
      ) : (
        <>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
            <input className="form-control" style={{ paddingLeft: 36 }} placeholder="Search instructors to add"
              value={qy} onChange={(e) => setQy(e.target.value)} />
          </div>
          {available.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>No matching instructors available.</p> : (
            available.map((i) => (
              <div key={i.id} className="assigned-row">
                <div className="ar-body">
                  <div className="ar-title">{i.name}</div>
                  {i.title && <div className="ar-sub">{i.title}</div>}
                </div>
                <Button className="btn btn-outline btn-sm" onClick={() => add(i.id)}><UserPlus /> Add</Button>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

function ContentSection({ id, batchId, reload, store, bucket, title, Icon, items, placeholder, installments }) {
  const { addItem, removeItem, uploadMaterial, setItemInstallment, reorderItems, updateItem } = store;
  const [value, setValue] = useState("");
  const [url, setUrl] = useState("");
  const [pw, setPw] = useState("");             // link password for a new recording
  const [seq, setSeq] = useState(0); // payment stage for newly added items
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [editId, setEditId] = useState(null);  // item being edited
  const [et, setEt] = useState("");             // edited title
  const [eu, setEu] = useState("");             // edited url
  const [ep, setEp] = useState("");             // edited recording link password

  // The store refresh only carries the current batch, so re-fetch the viewed batch after each change.
  const removeItemB = async (b, itemId) => { await removeItem(id, b, itemId); await reload(); };
  const setItemInstallmentB = async (b, itemId, s) => { await setItemInstallment(id, b, itemId, s); await reload(); popup.toast("Visibility updated"); };
  const beginEdit = (it) => { setEditId(it.id); setEt(it.t); setEu(it.u || ""); setEp(it.pw || ""); };
  const saveEdit = async (it) => {
    if (!et.trim()) return;
    const r = await updateItem(id, bucket, it.id, et.trim(), it.filename ? undefined : eu.trim(), bucket === "recordings" ? ep : undefined);
    if (r.ok) { setEditId(null); await reload(); }
  };
  const dragIdRef = useRef(null);              // synchronous source of truth for the drag
  const [dragId, setDragId] = useState(null);  // mirror, only for the .dragging style
  const [overId, setOverId] = useState(null);
  const isMaterials = bucket === "materials";
  const isRecordings = bucket === "recordings";
  const buckets = installmentBuckets(installments);
  const TINTS = {
    recordings: { bg: "#EFF6FF", color: "#2563EB" },
    links: { bg: "#F0FDF4", color: "#16A34A" },
    materials: { bg: "#FFFBEB", color: "#D97706" },
  };
  const tint = TINTS[bucket] || TINTS.recordings;

  // Drag-and-drop to reorder items (new items are appended at the bottom by the server).
  const startDrag = (itemId) => { dragIdRef.current = itemId; setDragId(itemId); };
  const endDrag = () => { dragIdRef.current = null; setDragId(null); setOverId(null); };
  const onDrop = async (targetId) => {
    const did = dragIdRef.current;
    endDrag();
    if (did == null || did === targetId) return;
    const ids = items.map((it) => it.id);
    ids.splice(ids.indexOf(targetId), 0, ids.splice(ids.indexOf(did), 1)[0]);
    await reorderItems(id, bucket, ids);
    await reload();
  };

  const add = async () => {
    if (!value.trim()) { setErr("Enter a title."); return; }
    setErr(null);
    const r = await addItem(id, batchId, bucket, value.trim(), url.trim(), seq, isRecordings ? pw.trim() : undefined);
    if (r.ok) { setValue(""); setUrl(""); setPw(""); await reload(); popup.toast(`Added to ${title}`); } else setErr(r.msg);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setErr(null);
    const r = await uploadMaterial(id, batchId, file, seq);
    setBusy(false);
    if (!r.ok) setErr(r.msg); else { await reload(); popup.toast("File uploaded"); }
  };

  return (
    <div className="content-section" style={{ marginBottom: 14 }}>
      <div className="content-section-head"><Icon /> {title} <span className="tab-count">{items.length}</span></div>
      <p className="content-empty" style={{ marginBottom: 12 }}>Choose the payment stage each item unlocks at. It stays available from that stage onward. Pick <strong>None</strong> to add an item that stays hidden from students and instructors until you enable it.</p>
      {items.length === 0 ? <p className="content-empty">Nothing here yet.</p> : (
        <div>
          {items.map((it) => (
            <div key={it.id}
              className={"content-item" + (overId === it.id ? " drag-over" : "") + (dragId === it.id ? " dragging" : "") + ((Number(it.seq) || 0) < 0 ? " is-hidden" : "")}
              onDragOver={(e) => { if (dragIdRef.current != null) { e.preventDefault(); setOverId(it.id); } }}
              onDragLeave={() => setOverId((o) => (o === it.id ? null : o))}
              onDrop={() => onDrop(it.id)}>
              <div className="content-item-head">
                {editId === it.id ? (
                  <>
                    <span className="ci-icon" style={{ background: tint.bg }}><Icon style={{ width: 18, height: 18, color: tint.color }} /></span>
                    <div className="mr-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input className="form-control" value={et} placeholder="Title"
                        onChange={(e) => setEt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(it); if (e.key === "Escape") setEditId(null); }} autoFocus />
                      {!it.filename && <input className="form-control" value={eu} placeholder="URL (https://...)"
                        onChange={(e) => setEu(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(it); if (e.key === "Escape") setEditId(null); }} />}
                      {isRecordings && <input className="form-control" value={ep} placeholder="Link password (e.g. Zoom passcode)"
                        onChange={(e) => setEp(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(it); if (e.key === "Escape") setEditId(null); }} />}
                    </div>
                    <button className="icon-btn-soft" title="Save" onClick={() => saveEdit(it)}><Check style={{ width: 16, height: 16 }} /></button>
                    <button className="icon-btn-plain" title="Cancel" onClick={() => setEditId(null)}><X style={{ width: 16, height: 16 }} /></button>
                  </>
                ) : (
                  <>
                    <span className="drag-handle" draggable
                      onDragStart={(e) => { startDrag(it.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={endDrag}><GripVertical /></span>
                    <span className="ci-icon" style={{ background: tint.bg }}><Icon style={{ width: 18, height: 18, color: tint.color }} /></span>
                    <div className="mr-body">
                      <div className="mr-title" style={{ marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                        {it.t}
                        {(Number(it.seq) || 0) < 0 && <span className="hidden-tag"><EyeOff style={{ width: 12, height: 12 }} /> Hidden</span>}
                        {isRecordings && it.pw && <span className="hidden-tag" style={{ color: "#2563EB", background: "#EFF6FF" }}>Passcode set</span>}
                      </div>
                      {it.filename
                        ? <div className="mr-meta"><span className="ext-tag">{it.ext}</span> {it.size}</div>
                        : it.u && <div className="ci-url">{it.u}</div>}
                    </div>
                    <button className="icon-btn-soft" title="Edit" onClick={() => beginEdit(it)}><Pencil style={{ width: 15, height: 15 }} /></button>
                    <button className="icon-btn-plain" title="Remove" onClick={() => removeItemB(bucket, it.id)}><X style={{ width: 16, height: 16 }} /></button>
                  </>
                )}
              </div>
              <div className="content-item-foot">
                <StageSelect stages={buckets} value={Number(it.seq) || 0} onChange={(s) => setItemInstallmentB(bucket, it.id, s)} feedback />
              </div>
            </div>
          ))}
        </div>
      )}
      {err && <div className="field-error" style={{ marginTop: 8 }}>{err}</div>}
      <div className="toolbar" style={{ marginTop: 14, marginBottom: 0, alignItems: "flex-start" }}>
        <input className="form-control" style={{ flex: "1 1 150px" }} placeholder={placeholder} value={value}
          onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <input className="form-control" style={{ flex: "1 1 180px" }} placeholder={isMaterials ? "Link URL (or upload a file)" : "URL (https://...)"} value={url}
          onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        {isRecordings && (
          <input className="form-control" style={{ flex: "1 1 150px" }} placeholder="Link password (optional)" value={pw}
            onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        )}
        <Button className="btn btn-ghost" onClick={add}><Plus /> Add</Button>
        {isMaterials && (
          <label className="btn btn-outline" style={{ cursor: busy ? "default" : "pointer" }}>
            <Upload /> {busy ? "Uploading..." : "Upload file"}
            <input type="file" style={{ display: "none" }} onChange={onFile} disabled={busy} />
          </label>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <StageSelect stages={buckets} value={seq} onChange={setSeq} />
      </div>
    </div>
  );
}

/* Dropdown to set the payment stage a content item unlocks at. Uses an
   optimistic local value so the selection does not flicker back to the old
   value while the save round-trips. */
function StageSelect({ stages, value, onChange, feedback = false }) {
  const [localSeq, setLocalSeq] = useState(Number(value) || 0);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);
  useEffect(() => { setLocalSeq(Number(value) || 0); }, [value]);
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const change = (s) => {
    setLocalSeq(s);
    onChange(s);
    if (feedback) { setSaved(true); clearTimeout(savedTimer.current); savedTimer.current = setTimeout(() => setSaved(false), 1800); }
  };
  return (
    <div className="stage-select">
      <span className="stage-select-label">Unlocks at</span>
      <select className="form-control" value={localSeq}
        onChange={(e) => change(Number(e.target.value))}>
        {stages.map((b) => <option key={b.seq} value={b.seq}>{b.label}</option>)}
      </select>
      {feedback && saved && <span className="stage-saved"><Check style={{ width: 13, height: 13 }} /> Saved</span>}
    </div>
  );
}

function Stat({ label, value, icon: Icon, bg, color }) {
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
