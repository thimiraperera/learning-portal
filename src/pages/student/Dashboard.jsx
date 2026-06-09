import { useNavigate, Link } from "react-router-dom";
import {
  BookOpen, PlayCircle, FileDown, Link2, ChevronRight, Lock, ArrowRight,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

const RECENT_COUNT = 6;

export default function Dashboard() {
  const { currentUser, courses, locked } = useStore();
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

      {locked.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div className="nav-label" style={{ color: "#9CA3AF", padding: "0 0 4px" }}>
            OTHER COURSES (NOT ENROLLED)
          </div>
          <div className="locked-list">
            {locked.map((c) => (
              <div key={c.id} className="locked-pill"><Lock /> {c.title}</div>
            ))}
          </div>
        </div>
      )}
    </Layout>
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
