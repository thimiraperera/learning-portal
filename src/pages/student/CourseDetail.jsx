import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, PlayCircle, Link2, FileDown, Clock, FileQuestion, Play, Lock,
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
  const { currentUser, courses, exams, downloadMaterial, paymentLocked } = useStore();
  const [tab, setTab] = useState("recordings");

  // Guard: never render a course the student isn't enrolled in.
  if (!currentUser.enrolled.includes(id)) return <Navigate to="/" replace />;
  const c = courses[id];
  const isLocked = (paymentLocked || []).includes(id);
  const myExams = isLocked ? [] : exams.filter((x) => x.course_id === id);

  const tabs = [
    { k: "recordings", label: "Recordings", icon: PlayCircle, n: c.recordings.length },
    { k: "links", label: "Course links", icon: Link2, n: c.links.length },
    { k: "materials", label: "Materials", icon: FileDown, n: c.materials.length },
    ...(myExams.length > 0 ? [{ k: "exam", label: "Exams", icon: FileQuestion, n: myExams.length }] : []),
  ];

  return (
    <Layout title="Course">
      <button className="back-link" onClick={() => navigate("/")}>
        <ArrowLeft /> All courses
      </button>

      <div className="page-hero">
        {/* Course code hidden for now: <div className="ph-code">{c.code}</div> */}
        <h1>{c.title}</h1>
        <p>{c.blurb}</p>
      </div>

      {isLocked && (
        <div className="card" style={{ marginBottom: 18, borderLeft: "4px solid var(--danger)" }}>
          <div className="card-title" style={{ color: "var(--danger)" }}><Lock style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6 }} /> Course access locked</div>
          <div className="card-subtitle" style={{ marginBottom: 0 }}>Access to this course is currently locked. This usually means a payment is outstanding. Please settle your balance or contact your administrator to restore access.</div>
        </div>
      )}

      {!isLocked && (
      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> {t.label} <span className="tab-count">{t.n}</span>
            </button>
          ))}
        </div>

        {tab === "recordings" && (
          c.recordings.length === 0
            ? <div className="empty-state"><div className="empty-icon"><PlayCircle /></div><p>No recordings have been published yet.</p></div>
            : c.recordings.map((r) => (
                <MediaRow key={`r${r.id}`} icon={PlayCircle} title={r.t} locked={r.locked} lockLabel={r.lockLabel}
                  action={r.u ? "Watch" : null} onAction={r.u ? () => openUrl(r.u) : null} />
              ))
        )}

        {tab === "links" && (
          c.links.length === 0
            ? <div className="empty-state"><div className="empty-icon"><Link2 /></div><p>No course links have been added yet.</p></div>
            : c.links.map((r) => (
                <MediaRow key={`l${r.id}`} icon={Link2} title={r.t} locked={r.locked} lockLabel={r.lockLabel}
                  action={r.u ? "Open" : null} onAction={r.u ? () => openUrl(r.u) : null} />
              ))
        )}

        {tab === "materials" && (
          c.materials.length === 0
            ? <div className="empty-state"><div className="empty-icon"><FileDown /></div><p>No materials have been added yet.</p></div>
            : c.materials.map((r) => (
                <MediaRow key={`m${r.id}`} icon={FileDown} title={r.t} locked={r.locked} lockLabel={r.lockLabel}
                  action={r.filename ? "Download" : (r.u ? "Open" : null)}
                  onAction={r.filename ? () => downloadMaterial(r.id, r.t) : (r.u ? () => openUrl(r.u) : null)}
                  meta={r.filename ? <><span className="ext-tag">{r.ext}</span> {r.size}</> : null} />
              ))
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
      )}
    </Layout>
  );
}

function MediaRow({ icon: Icon, title, meta, action, onAction, locked, lockLabel }) {
  return (
    <div className="media-row">
      <div className="mr-icon"><Icon /></div>
      <div className="mr-body">
        <div className="mr-title">{title}</div>
        {locked
          ? <div className="mr-meta" style={{ display: "flex", alignItems: "center", gap: 6, color: "#9CA3AF" }}><Lock style={{ width: 13, height: 13 }} /> Unlocks after {lockLabel}</div>
          : (meta && <div className="mr-meta">{meta}</div>)}
      </div>
      {locked
        ? <span className="badge badge-muted">Locked</span>
        : (action && <button className="btn btn-outline btn-sm" onClick={onAction || undefined}>{action}</button>)}
    </div>
  );
}
