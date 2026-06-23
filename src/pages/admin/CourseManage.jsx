import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Users, PlayCircle, Link2, FileDown, Save, Trash2, Plus, X,
  CheckCircle, AlertTriangle, Presentation, Settings as SettingsIcon, Search, UserPlus, UserMinus, Eye, EyeOff, GripVertical, Upload, Wallet, Pencil, Check, Layers,
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
import { useStore } from "../../state.jsx";
import { rs, fmtDate, planBadge, installmentBuckets } from "../../lib/payments.js";

export default function CourseManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useStore();
  const { courses, users, fetchCourseBatch, startNewBatch } = store;
  const c = courses[id];
  const [tab, setTab] = useState("details"); // open on Course details (first tab)
  const [viewBatchId, setViewBatchId] = useState(null); // null = current
  const [bc, setBc] = useState(null);                   // viewed batch's content/instructors
  const [batchBusy, setBatchBusy] = useState(false);

  const batches = c ? (c.batches || []) : [];
  const activeBatchId = viewBatchId || (c && c.batchId);
  const viewedBatch = batches.find((b) => b.id === activeBatchId) || null;

  // Load the viewed batch's content/instructors/plan; refreshed after mutations.
  const reload = useCallback(async () => {
    if (!c || !activeBatchId) return;
    try { setBc(await fetchCourseBatch(id, activeBatchId)); } catch { /* keep last */ }
  }, [id, activeBatchId, c, fetchCourseBatch]);
  useEffect(() => { reload(); }, [reload]);

  if (!c) return <Navigate to="/admin/courses" replace />;

  // Data for the viewed batch (falls back to the store's current-batch course until fetched).
  const data = bc && bc.batchId === activeBatchId ? bc : c;
  const viewedNum = viewedBatch ? viewedBatch.number : null;
  const inBatch = (u) => u.enrolled.includes(id) && (u.enrolledBatch ? u.enrolledBatch[id] === viewedNum : true);
  const enrolledCount = Object.values(users).filter(inBatch).length;

  const tabs = [
    { k: "details", label: "Course details", icon: SettingsIcon },
    { k: "plan", label: "Payment plan", icon: Wallet },
    { k: "students", label: "Enrolled students", icon: Users, n: enrolledCount },
    { k: "instructor", label: "Instructors", icon: Presentation, n: data.instructors.length },
    { k: "recordings", label: "Recordings", icon: PlayCircle, n: data.recordings.length },
    { k: "links", label: "Course links", icon: Link2, n: data.links.length },
    { k: "materials", label: "Materials", icon: FileDown, n: data.materials.length },
  ];

  const onStartNewBatch = async () => {
    if (!(await popup.confirm("Start a new batch? The current batch is marked ended, and its instructors, content, and payment plan are copied into a fresh batch (students are not copied).", { title: "Start new batch", confirmText: "Start new batch" }))) return;
    setBatchBusy(true);
    const r = await startNewBatch(id, {});
    setBatchBusy(false);
    if (r.ok) setViewBatchId(null); // jump to the new ongoing batch
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
        </div>
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
        {tab === "plan" && <CoursePlanTab id={id} batchId={activeBatchId} store={store} />}
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

  const defaultName = templates.find((t) => t.id === defaultId)?.name || "Classic";
  const preview = async () => {
    const tid = certTemplate || defaultId;
    if (tid) { try { await store.previewCertTemplate(tid); } catch (e) { setMsg({ ok: false, msg: e.message }); } }
  };

  const save = async () => setMsg(await store.updateCourse(id, { code, title, sessions: c.sessions ?? 0, blurb, certTemplate }));
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
        <textarea className="form-control" rows="3" value={blurb} onChange={(e) => setBlurb(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Certificate template</label>
        <div style={{ display: "flex", gap: 10 }}>
          <select className="form-control" style={{ maxWidth: 300 }} value={certTemplate} onChange={(e) => setCertTemplate(e.target.value)}>
            <option value="">Default ({defaultName})</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn-outline" type="button" onClick={preview}><Eye /> Preview</button>
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>Used for every certificate issued for this course. The default is locked in automatically on first issue.</div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button className="btn btn-primary" onClick={save}><Save /> Save changes</Button>
        <Button className="btn btn-danger" onClick={remove}><Trash2 /> Delete course</Button>
      </div>
    </div>
  );
}

function StudentsTab({ id, batchId, batchNum, store, navigate }) {
  const { users, toggleEnrol, plans } = store;
  const planByUser = {};
  (plans || []).forEach((p) => { if (p.course_id === id) planByUser[p.user_id] = p; });
  const [qy, setQy] = useState("");
  const [status, setStatus] = useState("all");
  const [enrolment, setEnrolment] = useState("enrolled"); // all | enrolled | not; default shows this batch's students
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const inThisBatch = (s) => s.enrolled.includes(id) && (s.enrolledBatch ? s.enrolledBatch[id] === batchNum : true);
  const inCourse = (s) => s.enrolled.includes(id);
  const ql = qy.trim().toLowerCase();
  const all = Object.entries(users).filter(([, u]) => u.role === "student");
  const enrolledCount = all.filter(([, s]) => inThisBatch(s)).length;

  const filtered = all
    .filter(([, s]) => status === "all" || s.status === status)
    .filter(([, s]) => enrolment === "all" ? (inThisBatch(s) || !inCourse(s)) : (enrolment === "enrolled" ? inThisBatch(s) : !inCourse(s)))
    .filter(([email, s]) => !ql || s.name.toLowerCase().includes(ql) || email.toLowerCase().includes(ql) || (s.username || "").toLowerCase().includes(ql));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const resetPage = () => setPage(1);
  const activeFilters = (status !== "all") + (enrolment !== "enrolled") + (ql ? 1 : 0);

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
          <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search by full name or email"
            value={qy} onChange={(e) => { setQy(e.target.value); resetPage(); }} />
        </div>
        <select className="form-control" style={{ flex: "0 0 160px" }} value={enrolment} onChange={(e) => { setEnrolment(e.target.value); resetPage(); }}>
          <option value="all">All students</option>
          <option value="enrolled">Enrolled only</option>
          <option value="not">Not enrolled</option>
        </select>
        <select className="form-control" style={{ flex: "0 0 150px" }} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="invited">Invited</option>
        </select>
        {activeFilters > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setStatus("all"); setEnrolment("enrolled"); resetPage(); }}><X /> Clear</button>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 12 }}>{enrolledCount} enrolled in Batch {batchNum} · {filtered.length} of {all.length} students shown</div>

      {filtered.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>No students match.</p>
      ) : (
        <>
          {slice.map(([email, s]) => {
            const isEnrolled = inThisBatch(s);
            const plan = planByUser[s.id];
            const pb = isEnrolled ? planBadge(plan ? plan.status : "empty") : null;
            return (
              <div key={email} className="assigned-row">
                <div className="ar-body">
                  <div className="ar-title">
                    {s.name}
                    {isEnrolled && <span className="badge badge-accepted" style={{ marginLeft: 6 }}>enrolled</span>}
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
                {isEnrolled
                  ? <Button className="btn btn-ghost btn-sm" onClick={() => toggleEnrol(email, id, batchId)}><UserMinus /> Remove</Button>
                  : <Button className="btn btn-primary btn-sm" onClick={() => toggleEnrol(email, id, batchId)}><UserPlus /> Add to Batch {batchNum}</Button>}
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

function CoursePlanTab({ id, batchId, store }) {
  const { fetchCoursePlan, saveCoursePlan, applyCoursePlan } = store;
  const [plan, setPlan] = useState(null);
  const [preview, setPreview] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const blank = { total_fee: 0, reg_fee: 0, installments: 0, start_date: "", completion_date: "" };
    setPlan(null);
    fetchCoursePlan(id, batchId)
      .then((d) => { if (alive) { setPlan(d.plan || blank); setPreview(d.preview || []); } })
      .catch(() => { if (alive) setPlan(blank); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, batchId]);

  if (!plan) return <p style={{ color: "#9CA3AF", fontSize: 13 }}>Loading...</p>;

  const set = (k) => (e) => setPlan((p) => ({ ...p, [k]: e.target.value }));
  // Save the template and immediately apply it to every enrolled student, so
  // each student follows the course plan with no per-student setup.
  const saveAndApply = async () => {
    setBusy(true); setMsg(null);
    const r = await saveCoursePlan(id, batchId, plan);
    if (!r.ok) { setBusy(false); setMsg({ ok: false, text: r.msg }); return; }
    setPlan(r.plan); setPreview(r.preview || []);
    const a = await applyCoursePlan(id, batchId);
    setBusy(false);
    setMsg(a.ok
      ? { ok: true, text: `Saved and applied to ${a.applied} enrolled student${a.applied === 1 ? "" : "s"}. New enrolments get it automatically.` }
      : { ok: false, text: `Saved, but applying failed: ${a.msg}` });
  };

  const previewTotal = preview.reduce((n, x) => n + Number(x.amount || 0), 0);

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="card-subtitle" style={{ marginTop: 0 }}>Set the fee plan for this course. Saving applies it to every enrolled student, and anyone enrolled later follows it automatically. You then record each student's payments on their own Payments tab.</div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}

      <div className="field-row">
        <div className="form-group"><label className="form-label">Total fee (Rs.)</label>
          <input className="form-control" type="number" min="0" value={plan.total_fee} onChange={set("total_fee")} placeholder="45000" /></div>
        <div className="form-group"><label className="form-label">Registration fee (Rs.)</label>
          <input className="form-control" type="number" min="0" value={plan.reg_fee} onChange={set("reg_fee")} placeholder="5000" /></div>
      </div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">Number of installments</label>
          <input className="form-control" type="number" min="0" max="36" value={plan.installments} onChange={set("installments")} placeholder="4" /></div>
        <div className="form-group"><label className="form-label">First payment / start date</label>
          <input className="form-control" type="date" value={plan.start_date} onChange={set("start_date")} /></div>
      </div>
      <div className="form-group" style={{ maxWidth: 320 }}><label className="form-label">Complete all payments by <span className="req">*</span></label>
        <input className="form-control" type="date" value={plan.completion_date} onChange={set("completion_date")} /></div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <Button className="btn btn-primary" loading={busy} onClick={saveAndApply}><Save /> Save & apply to enrolled students</Button>
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
                {preview.map((it, i) => (
                  <tr key={i}><td>{it.label}</td><td style={{ whiteSpace: "nowrap" }}>{rs(it.amount)}</td><td style={{ color: "#6B7280", whiteSpace: "nowrap" }}>{fmtDate(it.dueDate)}</td></tr>
                ))}
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
  const [seq, setSeq] = useState(0); // payment stage for newly added items
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [editId, setEditId] = useState(null);  // item being edited
  const [et, setEt] = useState("");             // edited title
  const [eu, setEu] = useState("");             // edited url

  // The store refresh only carries the current batch, so re-fetch the viewed batch after each change.
  const removeItemB = async (b, itemId) => { await removeItem(id, b, itemId); await reload(); };
  const setItemInstallmentB = async (b, itemId, s) => { await setItemInstallment(id, b, itemId, s); await reload(); };
  const beginEdit = (it) => { setEditId(it.id); setEt(it.t); setEu(it.u || ""); };
  const saveEdit = async (it) => {
    if (!et.trim()) return;
    const r = await updateItem(id, bucket, it.id, et.trim(), it.filename ? undefined : eu.trim());
    if (r.ok) { setEditId(null); await reload(); }
  };
  const dragIdRef = useRef(null);              // synchronous source of truth for the drag
  const [dragId, setDragId] = useState(null);  // mirror, only for the .dragging style
  const [overId, setOverId] = useState(null);
  const isMaterials = bucket === "materials";
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
    const r = await addItem(id, batchId, bucket, value.trim(), url.trim(), seq);
    if (r.ok) { setValue(""); setUrl(""); await reload(); } else setErr(r.msg);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setErr(null);
    const r = await uploadMaterial(id, batchId, file, seq);
    setBusy(false);
    if (!r.ok) setErr(r.msg); else await reload();
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
                <StageSelect stages={buckets} value={Number(it.seq) || 0} onChange={(s) => setItemInstallmentB(bucket, it.id, s)} />
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
function StageSelect({ stages, value, onChange }) {
  const [localSeq, setLocalSeq] = useState(Number(value) || 0);
  useEffect(() => { setLocalSeq(Number(value) || 0); }, [value]);
  return (
    <div className="stage-select">
      <span className="stage-select-label">Unlocks at</span>
      <select className="form-control" value={localSeq}
        onChange={(e) => { const s = Number(e.target.value); setLocalSeq(s); onChange(s); }}>
        {stages.map((b) => <option key={b.seq} value={b.seq}>{b.label}</option>)}
      </select>
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
