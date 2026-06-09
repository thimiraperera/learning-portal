import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PlayCircle, Link2, FileDown, Users, ChevronRight } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import { useStore } from "../../state.jsx";

const PER_PAGE = 8;

export default function Courses() {
  const { courses, users, addCourse } = useStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [page, setPage] = useState(1);

  const create = async () => { if (await addCourse(title, code)) { setTitle(""); setCode(""); } };

  const enrolledCount = (cid) => Object.values(users).filter((u) => u.enrolled.includes(cid)).length;

  const entries = Object.entries(courses);
  const pageCount = Math.max(1, Math.ceil(entries.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const slice = entries.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <Layout title="Courses">
      <div className="page-hero">
        <h1>Courses</h1>
        <p>Click a course to manage its content, details and enrolments.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Add a course</div>
        <div className="card-subtitle">A code identifies the course across the system.</div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input className="form-control" placeholder="Course title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="form-control" style={{ flex: "0 0 180px" }} placeholder="Code (e.g. EQ-101)" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-primary" onClick={create}><Plus /> Add course</button>
        </div>
      </div>

      <div className="course-grid">
        {slice.map(([id, c]) => (
          <button key={id} className="course-card" onClick={() => navigate(`/admin/courses/${id}`)}>
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
              <span className="cc-stat"><Users /> {enrolledCount(id)}</span>
              <span className="cc-enter">Manage <ChevronRight /></span>
            </div>
          </button>
        ))}
      </div>
      <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
    </Layout>
  );
}
