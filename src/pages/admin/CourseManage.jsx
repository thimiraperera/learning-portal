import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Users, PlayCircle, Link2, FileDown, Save, Trash2, Plus, X,
  CheckCircle, AlertTriangle, Presentation, Settings as SettingsIcon, Search, UserPlus, UserMinus, Eye, GripVertical,
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
  const [tab, setTab] = useState("content"); // content is the default open tab

  if (!c) return <Navigate to="/admin/courses" replace />;

  const enrolledCount = Object.values(users).filter((u) => u.enrolled.includes(id)).length;

  const tabs = [
    { k: "details", label: "Course details", icon: SettingsIcon },
    { k: "content", label: "Course content", icon: PlayCircle },
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
        {tab === "content" && <ContentManager id={id} c={c} store={store} />}
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
  const [msg, setMsg] = useState(null);

  const save = async () => setMsg(await store.updateCourse(id, { code, title, sessions, blurb }));
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const ql = qy.trim().toLowerCase();
  const enrolled = Object.entries(users)
    .filter(([, u]) => u.role === "student" && u.enrolled.includes(id))
    .filter(([email, s]) => !ql || s.name.toLowerCase().includes(ql) || email.toLowerCase().includes(ql) || (s.username || "").toLowerCase().includes(ql));

  const pageCount = Math.max(1, Math.ceil(enrolled.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = enrolled.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
        <input className="form-control" style={{ paddingLeft: 36 }} placeholder="Search enrolled students by name, email or username"
          value={qy} onChange={(e) => { setQy(e.target.value); setPage(1); }} />
      </div>

      <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 8px" }}>ENROLLED ({enrolled.length})</div>
      {enrolled.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>No enrolled students match.</p> : (
        <>
          {slice.map(([email, s]) => (
            <div key={email} className="assigned-row">
              <div className="ar-body">
                <div className="ar-title">{s.name}</div>
                <div className="ar-sub">{s.email}{s.phone ? ` · ${s.phone}` : ""}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/students/${s.id}`)}><Eye /> View profile</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleEnrol(email, id)}><UserMinus /> Remove</button>
            </div>
          ))}
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
            pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={enrolled.length} />
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

function ContentManager({ id, c, store }) {
  return (
    <>
      <p style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 16 }}>Add items to each category. Drag the handle to reorder within a category.</p>
      <ContentSection id={id} store={store} bucket="recordings" title="Recordings" Icon={PlayCircle} items={c.recordings} placeholder="Recording title or URL" />
      <ContentSection id={id} store={store} bucket="links" title="Course links" Icon={Link2} items={c.links} placeholder="Link title or URL" />
      <ContentSection id={id} store={store} bucket="materials" title="Materials" Icon={FileDown} items={c.materials} placeholder="Material title or filename" />
    </>
  );
}

function ContentSection({ id, store, bucket, title, Icon, items, placeholder }) {
  const { addItem, removeItem, reorderItems } = store;
  const [value, setValue] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const add = async () => { if (value.trim()) { await addItem(id, bucket, value); setValue(""); } };

  const onDrop = async (targetId) => {
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
    <div className="content-section">
      <div className="content-section-head"><Icon /> {title} <span className="tab-count">{items.length}</span></div>
      {items.length === 0 ? <p className="content-empty">Nothing here yet.</p> : (
        <div>
          {items.map((it) => (
            <div key={it.id}
              className={"media-row drag-row" + (overId === it.id ? " drag-over" : "") + (dragId === it.id ? " dragging" : "")}
              draggable
              onDragStart={() => setDragId(it.id)}
              onDragOver={(e) => { e.preventDefault(); setOverId(it.id); }}
              onDragLeave={() => setOverId((o) => (o === it.id ? null : o))}
              onDrop={() => onDrop(it.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}>
              <span className="drag-handle"><GripVertical /></span>
              <div className="mr-body"><div className="mr-title" style={{ marginBottom: 0 }}>{it.t}</div></div>
              <button className="icon-btn-plain" onClick={() => removeItem(id, bucket, it.id)}><X style={{ width: 16, height: 16 }} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
        <input className="form-control" placeholder={placeholder} value={value}
          onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="btn btn-ghost" onClick={add}><Plus /> Add</button>
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
