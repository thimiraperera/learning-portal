import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  BookOpen, PlayCircle, FileDown, Link2, ChevronRight, Lock, ArrowRight, Award, Download, AlertTriangle,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";
import { previewWords } from "../../lib/text.js";

const RECENT_COUNT = 6;

export default function Dashboard() {
  const { currentUser, courses, locked, certificates, downloadCertificate, payments, paymentLocked } = useStore();
  const navigate = useNavigate();
  const my = currentUser.enrolled;
  const missedTotal = (payments || []).reduce((n, p) => n + (p.missedCount || 0), 0);
  const lockedCount = (paymentLocked || []).length;

  const totalRecordings = my.reduce((n, id) => n + (courses[id]?.recordings.length || 0), 0);
  const totalMaterials = my.reduce((n, id) => n + (courses[id]?.materials.length || 0), 0);

  // Most recent enrolments first; show only the latest few on the dashboard.
  const recent = [...my].reverse().slice(0, RECENT_COUNT);
  const greeting = currentUser.firstName || currentUser.nickname || currentUser.name.split(" ")[0];

  return (
    <Layout title="Dashboard">
      <div className="page-hero">
        <h1>Welcome back, {greeting}.</h1>
        <p>You're enrolled in {my.length} {my.length === 1 ? "course" : "courses"}.</p>
        {currentUser.regNo && (
          <p style={{ marginTop: 6, fontSize: 13 }}>Registration No: <strong style={{ color: "var(--primary)" }}>{currentUser.regNo}</strong></p>
        )}
      </div>

      {missedTotal > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 18 }}>
          <AlertTriangle /> You have {missedTotal} missed installment{missedTotal === 1 ? "" : "s"}. Please settle to keep your course access active{lockedCount > 0 ? `; ${lockedCount} course${lockedCount === 1 ? " is" : "s are"} currently locked.` : "."} Open a course and check its Payments tab for the schedule.
        </div>
      )}

      <div className="stats-grid">
        <Stat label="Enrolled Courses" value={my.length} sub="Active enrolments" icon={BookOpen} bg="#EBF2FF" color="#1E509B" />
        <Stat label="Recordings" value={totalRecordings} sub="Across your courses" icon={PlayCircle} bg="#EFF6FF" color="#2563EB" />
        <Stat label="Materials" value={totalMaterials} sub="Downloads available" icon={FileDown} bg="#F0FDF4" color="#16A34A" />
        <Stat label="Other Courses" value={locked.length} sub="Not enrolled" icon={Lock} bg="#FFFBEB" color="#D97706" />
      </div>

      {my.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><BookOpen /></div>
            <p>You're not enrolled in any course yet. An administrator will add you soon.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="section-header">
            <div className="card-title">Recent courses</div>
            {my.length > RECENT_COUNT && (
              <Link to="/courses" className="view-all">View all {my.length} <ArrowRight /></Link>
            )}
          </div>
          <div className="course-grid">
            {recent.map((id) => courses[id] && (
              <CourseCard key={id} c={courses[id]} onClick={() => navigate(`/courses/${id}`)} />
            ))}
          </div>
        </>
      )}

      {certificates.length > 0 && <CertificatesSection certificates={certificates} download={downloadCertificate} />}

      {locked.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div className="section-header">
            <div className="card-title">Other courses</div>
            <Link to="/browse" className="view-all">Browse {locked.length} <ArrowRight /></Link>
          </div>
          <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6 }}>
            {locked.length} course{locked.length === 1 ? "" : "s"} you can request to join.
          </p>
        </div>
      )}
    </Layout>
  );
}

function CertificatesSection({ certificates, download }) {
  const [msg, setMsg] = useState(null);
  const get = async (c) => {
    setMsg(null);
    try { await download(c.id, c.cert_no); }
    catch (e) { setMsg({ id: c.id, text: e.message }); }
  };
  return (
    <div className="card" style={{ marginTop: 28 }}>
      <div className="card-title"><Award style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />My certificates</div>
      <div className="card-subtitle">You can download each certificate once. If you need it again, ask your administrator to unlock it.</div>
      {certificates.map((c) => {
        const canDownload = !c.downloaded || c.unlocked;
        return (
          <div key={c.id} className="media-row" style={{ marginBottom: 8 }}>
            <div className="mr-icon"><Award /></div>
            <div className="mr-body">
              <div className="mr-title">{c.courseTitle} <span className="cc-code" style={{ marginLeft: 6 }}>{c.courseCode}</span></div>
              <div className="mr-meta">Certificate {c.cert_no}{c.downloaded && !c.unlocked ? " · already downloaded" : ""}</div>
              {msg && msg.id === c.id && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}><AlertTriangle style={{ width: 12, height: 12, verticalAlign: "-2px" }} /> {msg.text}</div>}
            </div>
            {canDownload
              ? <button className="btn btn-primary btn-sm" onClick={() => get(c)}><Download /> Download</button>
              : <button className="btn btn-ghost btn-sm" disabled style={{ opacity: 0.6 }}>Downloaded</button>}
          </div>
        );
      })}
    </div>
  );
}

export function CourseCard({ c, onClick }) {
  const { brand } = useStore();
  return (
    <button className="course-card" onClick={onClick}>
      <div className="cc-top">
        <span className="cc-code">{c.code}</span>
        <span className="cc-sessions">{c.sessions} sessions</span>
      </div>
      <h3>{c.title}</h3>
      <div className="cc-blurb">{previewWords(c.blurb, brand.courseCardWords)}</div>
      <div className="cc-foot">
        <span className="cc-stat"><PlayCircle /> {c.recordings.length}</span>
        <span className="cc-stat"><Link2 /> {c.links.length}</span>
        <span className="cc-stat"><FileDown /> {c.materials.length}</span>
        <span className="cc-enter">Enter <ChevronRight /></span>
      </div>
    </button>
  );
}

function Stat({ label, value, sub, icon: Icon, bg, color }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className="stat-label">{label}</div>
        <div className="stat-icon" style={{ background: bg }}><Icon style={{ color }} /></div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}
