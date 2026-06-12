import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, PlayCircle, Link2, FileDown, Layers } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { openUrl } from "../student/CourseDetail.jsx";
import { useStore } from "../../state.jsx";

/* Read-only course view for instructors: the grouped content of a course
   they are assigned to. */
export default function InstructorCourseView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { courses, downloadMaterial } = useStore();
  const c = courses[id];
  if (!c) return <Navigate to="/instructor" replace />;
  const groups = c.groups || [];
  const contentCount = c.recordings.length + c.links.length + c.materials.length;

  return (
    <Layout title="Course">
      <button className="back-link" onClick={() => navigate("/instructor")}><ArrowLeft /> All courses</button>

      <div className="page-hero">
        <div className="ph-code">{c.code}</div>
        <h1>{c.title}</h1>
        <p>{c.blurb}</p>
      </div>

      <div className="card">
        <div className="content-section-head" style={{ marginBottom: 16 }}><Layers /> Course content <span className="tab-count">{contentCount}</span></div>
        {contentCount === 0
          ? <div className="empty-state"><div className="empty-icon"><Layers /></div><p>No content has been published for this course yet.</p></div>
          : groups.map((g) => {
              const n = g.recordings.length + g.links.length + g.materials.length;
              if (n === 0) return null;
              return (
                <div key={g.id} className="content-section">
                  <div className="content-section-head"><Layers /> {g.title} <span className="tab-count">{n}</span></div>
                  {g.recordings.map((r) => (
                    <Row key={`r${r.id}`} icon={PlayCircle} title={r.t}
                      action={r.u ? "Watch" : null} onAction={r.u ? () => openUrl(r.u) : null} />
                  ))}
                  {g.links.map((r) => (
                    <Row key={`l${r.id}`} icon={Link2} title={r.t}
                      action={r.u ? "Open" : null} onAction={r.u ? () => openUrl(r.u) : null} />
                  ))}
                  {g.materials.map((r) => (
                    <Row key={`m${r.id}`} icon={FileDown} title={r.t}
                      meta={r.filename ? <><span className="ext-tag">{r.ext}</span> {r.size}</> : null}
                      action={r.filename ? "Download" : (r.u ? "Open" : null)}
                      onAction={r.filename ? () => downloadMaterial(r.id, r.t) : (r.u ? () => openUrl(r.u) : null)} />
                  ))}
                </div>
              );
            })}
      </div>
    </Layout>
  );
}

function Row({ icon: Icon, title, meta, action, onAction }) {
  return (
    <div className="media-row">
      <div className="mr-icon"><Icon /></div>
      <div className="mr-body">
        <div className="mr-title">{title}</div>
        {meta && <div className="mr-meta">{meta}</div>}
      </div>
      {action && <button className="btn btn-outline btn-sm" onClick={onAction || undefined}>{action}</button>}
    </div>
  );
}
