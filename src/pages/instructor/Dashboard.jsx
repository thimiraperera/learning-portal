import { useNavigate } from "react-router-dom";
import { BookOpen, PlayCircle, Link2, FileDown, ChevronRight } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

export default function InstructorDashboard() {
  const { currentUser, courses } = useStore();
  const navigate = useNavigate();
  const entries = Object.entries(courses);
  const greeting = currentUser.firstName || currentUser.nickname || currentUser.name.split(" ")[0];

  return (
    <Layout title="Dashboard">
      <div className="page-hero">
        <h1>Welcome, {greeting}.</h1>
        <p>You are assigned to {entries.length} {entries.length === 1 ? "course" : "courses"}.</p>
      </div>

      {entries.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><BookOpen /></div>
            <p>You are not assigned to any course yet. An administrator will add you soon.</p>
          </div>
        </div>
      ) : (
        <div className="course-grid">
          {entries.map(([id, c]) => (
            <button key={id} className="course-card" onClick={() => navigate(`/instructor/courses/${id}`)}>
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
                <span className="cc-enter">Open <ChevronRight /></span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Layout>
  );
}
