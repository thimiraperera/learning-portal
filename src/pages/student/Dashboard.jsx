import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  BookOpen, PlayCircle, FileDown, Link2, ChevronRight, Lock, ArrowRight, Award, Download, AlertTriangle,
  Wallet, CheckCircle,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

const RECENT_COUNT = 6;

const rs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-US");
function fmtDue(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function isPastDue(d) {
  if (!d) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt = new Date(d + "T00:00:00");
  return !isNaN(dt) && dt < today;
}

export default function Dashboard() {
  const { currentUser, courses, locked, certificates, downloadCertificate, payments } = useStore();
  const navigate = useNavigate();
  const my = currentUser.enrolled;

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
      </div>

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

      {payments && payments.length > 0 && <PaymentsSection plans={payments} />}

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

function PaymentsSection({ plans }) {
  return (
    <div className="card" style={{ marginTop: 28 }}>
      <div className="card-title"><Wallet style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />My payments</div>
      <div className="card-subtitle">Your registration and installment payments for each course.</div>
      {plans.map((p) => {
        const paidUp = p.remaining <= 0;
        const overdue = !paidUp && isPastDue(p.due_date);
        const tone = paidUp ? { bg: "#F0FDF4", border: "#16A34A", color: "#065F46" }
          : overdue ? { bg: "#FEF2F2", border: "#DC2626", color: "#991B1B" }
            : { bg: "#EFF6FF", border: "#2563EB", color: "#1E40AF" };
        const message = paidUp
          ? "Fully paid. Thank you."
          : `You have ${rs(p.remaining)} remaining${p.due_date ? `, due on ${fmtDue(p.due_date)}` : ""}.${overdue ? " This payment is overdue." : ""}`;
        return (
          <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>{p.courseTitle} <span className="cc-code" style={{ marginLeft: 4 }}>{p.courseCode}</span></div>
              <div style={{ fontSize: 12.5, color: "#6B7280" }}>Total {rs(p.total_fee)} · Paid {rs(p.paid)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "10px 12px", borderRadius: 10, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 13.5, fontWeight: 600 }}>
              {paidUp ? <CheckCircle style={{ width: 16, height: 16 }} /> : <AlertTriangle style={{ width: 16, height: 16 }} />}
              {message}
            </div>
            {p.payments.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 6px" }}>PAYMENTS RECEIVED</div>
                {p.payments.map((pay) => (
                  <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#6B7280", padding: "3px 0" }}>
                    <span>{fmtDue(new Date(Number(pay.paid_at)).toISOString().slice(0, 10))}{pay.note ? ` · ${pay.note}` : ""}</span>
                    <span style={{ fontWeight: 600, color: "#374151" }}>{rs(pay.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CourseCard({ c, onClick }) {
  return (
    <button className="course-card" onClick={onClick}>
      <div className="cc-top">
        <span className="cc-code">{c.code}</span>
        <span className="cc-sessions">{c.sessions} sessions</span>
      </div>
      <h3>{c.title}</h3>
      <div className="cc-blurb">{c.blurb}</div>
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
