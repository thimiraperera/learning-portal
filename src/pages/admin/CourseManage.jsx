import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Users, PlayCircle, Link2, FileDown, Save, Trash2, Plus, X,
  CheckCircle, AlertTriangle, Presentation, Settings as SettingsIcon, Search, UserPlus, UserMinus, Eye, GripVertical, Upload,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import { useStore } from "../../state.jsx";

export default function CourseManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useStore();
  const { courses, users } = store;
  const c = courses[id];
  const [tab, setTab] = useState("recordings"); // open on the first content tab

  if (!c) return <Navigate to="/admin/courses" replace />;

  const enrolledCount = Object.values(users).filter((u) => u.enrolled.includes(id)).length;

  const tabs = [
    { k: "details", label: "Course details", icon: SettingsIcon },
    { k: "recordings", label: "Recordings", icon: PlayCircle, n: c.recordings.length },
    { k: "links", label: "Course links", icon: Link2, n: c.links.length },
    { k: "materials", label: "Materials", icon: FileDown, n: c.materials.length },
    { k: "students", label: "Enrolled students", icon: Users, n: enrolledCount },
    { k: "instructor", label: "Instructors", icon: Presentation, n: c.instructors.length },
  ];

  return (
    <Layout title="Manage course">
      <button className="back-link" onClick={() => navigate("/admin/courses")}><ArrowLeft /> All courses</button>

      <div className="page-hero">
        <div className="ph-code">{c.code}</div>
        <h1>{c.title}</h1>
        <p>{c.instructor ? `Instructor: ${c.instructor}` : "No instructor assigned"}</p>
      </div>

      <div className="stats-grid">
        <Stat label="Enrolled" value={enrolledCount} icon={Users} bg="#EBF2FF" color="#1E509B" />
        <Stat label="Recordings" value={c.recordings.length} icon={PlayCircle} bg="#EFF6FF" color="#2563EB" />
        <Stat label="Links" value={c.links.length} icon={Link2} bg="#F0FDF4" color="#16A34A" />
        <Stat label="Materials" value={c.materials.length} icon={FileDown} bg="#FFFBEB" color="#D97706" />
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> {t.label}{t.n != null && <span className="tab-count">{t.n}</span>}
            </button>
          ))}
        </div>

        {tab === "details" && <DetailsTab id={id} c={c} store={store} navigate={navigate} />}
        {tab === "recordings" && <ContentSection id={id} groupId={0} store={store} bucket="recordings" title="Recordings" Icon={PlayCircle} items={c.recordings} placeholder="Recording title" />}
        {tab === "links" && <ContentSection id={id} groupId={0} store={store} bucket="links" title="Course links" Icon={Link2} items={c.links} placeholder="Link title" />}
        {tab === "materials" && <ContentSection id={id} groupId={0} store={store} bucket="materials" title="Materials" Icon={FileDown} items={c.materials} placeholder="Material title" />}
        {tab === "students" && <StudentsTab id={id} store={store} navigate={navigate} />}
        {tab === "instructor" && <InstructorTab id={id} c={c} store={store} navigate={navigate} />}
      </div>
    </Layout>
  );
}

function DetailsTab({ id, c, store, navigate }) {
  const [code, setCode] = useState(c.code);
  const [title, setTitle] = useState(c.title);
  const [sessions, setSessions] = useState(c.sessions ?? 0);
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

  const save = async () => setMsg(await store.updateCourse(id, { code, title, sessions, blurb, certTemplate }));
  const remove = async () => {
    if (!window.confirm(`Delete "${c.title}"? This removes its content and enrolments. This cannot be undone.`)) return;
    await store.deleteCourse(id);
    navigate("/admin/courses");
  };

  return (
    <div style={{ maxWidth: 620 }}>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
      <div className="field-row">
        <div className="form-group"><label className="form-label">Code</label>
          <input className="form-control" value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Sessions</label>
          <input className="form-control" type="number" min="0" value={sessions} onChange={(e) => setSessions(e.target.value)} /></div>
      </div>
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
        <button className="btn btn-primary" onClick={save}><Save /> Save changes</button>
        <button className="btn btn-danger" onClick={remove}><Trash2 /> Delete course</button>
      </div>
    </div>
  );
}

function StudentsTab({ id, store, navigate }) {
  const { users, toggleEnrol } = store;
  const [qy, setQy] = useState("");
  const [status, setStatus] = useState("all");
  const [enrolment, setEnrolment] = useState("all"); // all | enrolled | not
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const ql = qy.trim().toLowerCase();
  const all = Object.entries(users).filter(([, u]) => u.role === "student");
  const enrolledCount = all.filter(([, s]) => s.enrolled.includes(id)).length;

  const filtered = all
    .filter(([, s]) => status === "all" || s.status === status)
    .filter(([, s]) => enrolment === "all" || (enrolment === "enrolled" ? s.enrolled.includes(id) : !s.enrolled.includes(id)))
    .filter(([email, s]) => !ql || s.name.toLowerCase().includes(ql) || email.toLowerCase().includes(ql) || (s.username || "").toLowerCase().includes(ql));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const resetPage = () => setPage(1);
  const activeFilters = (status !== "all") + (enrolment !== "all") + (ql ? 1 : 0);

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
          <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setStatus("all"); setEnrolment("all"); resetPage(); }}><X /> Clear</button>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 12 }}>{enrolledCount} enrolled in this course · {filtered.length} of {all.length} students shown</div>

      {filtered.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>No students match.</p>
      ) : (
        <>
          {slice.map(([email, s]) => {
            const isEnrolled = s.enrolled.includes(id);
            return (
              <div key={email} className="assigned-row">
                <div className="ar-body">
                  <div className="ar-title">
                    {s.name}
                    {isEnrolled && <span className="badge badge-accepted" style={{ marginLeft: 6 }}>enrolled</span>}
                    <span className={"badge " + (s.status === "active" ? "badge-accepted" : "badge-pending")} style={{ marginLeft: 6 }}>{s.status}</span>
                  </div>
                  <div className="ar-sub">{s.email}{s.phone ? ` · ${s.phone}` : ""}</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/students/${s.id}`)}><Eye /> View</button>
                {isEnrolled
                  ? <button className="btn btn-ghost btn-sm" onClick={() => toggleEnrol(email, id)}><UserMinus /> Remove</button>
                  : <button className="btn btn-primary btn-sm" onClick={() => toggleEnrol(email, id)}><UserPlus /> Add</button>}
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

function InstructorTab({ id, c, store, navigate }) {
  const { instructors, addCourseInstructor, removeCourseInstructor } = store;
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
              <button className="btn btn-ghost btn-sm" onClick={() => removeCourseInstructor(id, i.id)}><UserMinus /> Remove</button>
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
                <button className="btn btn-outline btn-sm" onClick={() => addCourseInstructor(id, i.id)}><UserPlus /> Add</button>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

function ContentSection({ id, groupId, store, bucket, title, Icon, items, placeholder }) {
  const { addItem, removeItem, reorderItems, uploadMaterial } = store;
  const [value, setValue] = useState("");
  const [url, setUrl] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const isMaterials = bucket === "materials";

  const add = async () => {
    if (!value.trim()) { setErr("Enter a title."); return; }
    setErr(null);
    const r = await addItem(id, groupId, bucket, value.trim(), url.trim());
    if (r.ok) { setValue(""); setUrl(""); } else setErr(r.msg);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setErr(null);
    const r = await uploadMaterial(id, groupId, file);
    setBusy(false);
    if (!r.ok) setErr(r.msg);
  };

  const onDrop = async (e, targetId) => {
    e.stopPropagation();
    setOverId(null);
    if (dragId == null || dragId === targetId) { setDragId(null); return; }
    const ids = items.map((it) => it.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragId(null);
    await reorderItems(id, bucket, ids);
  };

  return (
    <div className="content-section" style={{ marginBottom: 14 }}>
      <div className="content-section-head"><Icon /> {title} <span className="tab-count">{items.length}</span></div>
      {items.length === 0 ? <p className="content-empty">Nothing here yet.</p> : (
        <div>
          {items.map((it) => (
            <div key={it.id}
              className={"media-row drag-row" + (overId === it.id ? " drag-over" : "") + (dragId === it.id ? " dragging" : "")}
              draggable
              onDragStart={(e) => { e.stopPropagation(); setDragId(it.id); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOverId(it.id); }}
              onDragLeave={() => setOverId((o) => (o === it.id ? null : o))}
              onDrop={(e) => onDrop(e, it.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}>
              <span className="drag-handle"><GripVertical /></span>
              <div className="mr-body">
                <div className="mr-title" style={{ marginBottom: 0 }}>{it.t}</div>
                {it.filename
                  ? <div className="mr-meta"><span className="ext-tag">{it.ext}</span> {it.size}</div>
                  : it.u && <div className="mr-meta" style={{ color: "var(--primary)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.u}</div>}
              </div>
              <button className="icon-btn-plain" onClick={() => removeItem(id, bucket, it.id)}><X style={{ width: 16, height: 16 }} /></button>
            </div>
          ))}
        </div>
      )}
      {err && <div className="field-error" style={{ marginTop: 8 }}>{err}</div>}
      <div className="toolbar" style={{ marginTop: 10, marginBottom: 0, alignItems: "flex-start" }}>
        <input className="form-control" style={{ flex: "1 1 160px" }} placeholder={placeholder} value={value}
          onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <input className="form-control" style={{ flex: "1 1 200px" }} placeholder={isMaterials ? "Link URL (or upload a file)" : "URL (https://...)"} value={url}
          onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="btn btn-ghost" onClick={add}><Plus /> Add</button>
        {isMaterials && (
          <label className="btn btn-outline" style={{ cursor: busy ? "default" : "pointer" }}>
            <Upload /> {busy ? "Uploading..." : "Upload file"}
            <input type="file" style={{ display: "none" }} onChange={onFile} disabled={busy} />
          </label>
        )}
      </div>
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
