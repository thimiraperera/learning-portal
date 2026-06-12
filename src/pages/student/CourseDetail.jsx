import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, PlayCircle, Link2, FileDown, Calendar, Clock, FileQuestion, Play, Layers,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

/* Open a user-entered URL safely in a new tab, adding https:// if missing. */
export function openUrl(u) {
  if (!u) return;
  const href = /^https?:\/\//i.test(u) ? u : "https://" + u;
  window.open(href, "_blank", "noopener,noreferrer");
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, courses, exams, downloadMaterial } = useStore();
  const [tab, setTab] = useState("content");

  // Guard: never render a course the student isn't enrolled in.
  if (!currentUser.enrolled.includes(id)) return <Navigate to="/" replace />;
  const c = courses[id];
  const groups = c.groups || [];
  const contentCount = c.recordings.length + c.links.length + c.materials.length;
  const myExams = exams.filter((x) => x.course_id === id);

  const tabs = [
    { k: "content", label: "Course content", icon: Layers, n: contentCount },
    ...(myExams.length > 0 ? [{ k: "exam", label: "Exams", icon: FileQuestion, n: myExams.length }] : []),
  ];

  return (
    <Layout title="Course">
      <button className="back-link" onClick={() => navigate("/")}>
        <ArrowLeft /> All courses
      </button>

      <div className="page-hero">
        <div className="ph-code">{c.code}</div>
        <h1>{c.title}</h1>
        <p>{c.blurb}</p>
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> {t.label} <span className="tab-count">{t.n}</span>
            </button>
          ))}
        </div>

        {tab === "content" && (
          contentCount === 0
            ? <div className="empty-state"><div className="empty-icon"><Layers /></div><p>No content has been published for this course yet.</p></div>
            : groups.map((g) => {
                const n = g.recordings.length + g.links.length + g.materials.length;
                if (n === 0) return null;
                return (
                  <div key={g.id} className="content-section">
                    <div className="content-section-head"><Layers /> {g.title} <span className="tab-count">{n}</span></div>
                    {g.recordings.map((r) => (
                      <MediaRow key={`r${r.id}`} icon={PlayCircle} title={r.t}
                        action={r.u ? "Watch" : null} onAction={r.u ? () => openUrl(r.u) : null} />
                    ))}
                    {g.links.map((r) => (
                      <MediaRow key={`l${r.id}`} icon={Link2} title={r.t}
                        action={r.u ? "Open" : null} onAction={r.u ? () => openUrl(r.u) : null} />
                    ))}
                    {g.materials.map((r) => (
                      <MediaRow key={`m${r.id}`} icon={FileDown} title={r.t}
                        action={r.filename ? "Download" : (r.u ? "Open" : null)}
                        onAction={r.filename ? () => downloadMaterial(r.id, r.t) : (r.u ? () => openUrl(r.u) : null)}
                        meta={r.filename ? <><span className="ext-tag">{r.ext}</span> {r.size}</> : null} />
                    ))}
                  </div>
                );
              })
        )}

        {tab === "exam" && myExams.map((x) => {
          const served = x.question_count > 0 ? Math.min(x.question_count, x.bankSize) : x.bankSize;
          const done = x.attempt && x.attempt.finished_at;
          return (
            <div key={x.id} className="media-row">
              <div className="mr-icon"><FileQuestion /></div>
              <div className="mr-body">
                <div className="mr-title">{x.title}</div>
                <div className="mr-meta">
                  {served} question{served === 1 ? "" : "s"}
                  {x.time_limit > 0 && <><span className="dot" /> <Clock /> {x.time_limit} min</>}
                </div>
              </div>
              {done
                ? <span className="badge badge-accepted">Score {parseFloat(Number(x.attempt.score).toFixed(2))}/{x.attempt.total}</span>
                : (
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/exams/${x.id}`)}>
                    <Play /> {x.attempt ? "Resume" : "Start exam"}
                  </button>
                )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}

function MediaRow({ icon: Icon, title, meta, action, onAction }) {
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
