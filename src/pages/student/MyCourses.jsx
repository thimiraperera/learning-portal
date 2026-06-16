import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import { CourseCard } from "./Dashboard.jsx";
import { useStore } from "../../state.jsx";

const PER_PAGE = 6;

export default function MyCourses() {
  const { currentUser, courses } = useStore();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const my = [...currentUser.enrolled].reverse(); // newest enrolment first
  const pageCount = Math.max(1, Math.ceil(my.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const slice = my.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <Layout title="My Courses">
      <div className="page-hero">
        <h1>My courses</h1>
        <p>All {my.length} {my.length === 1 ? "course" : "courses"} you're enrolled in.</p>
      </div>

      {my.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><GraduationCap /></div>
            <p>You're not enrolled in any course yet.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="course-grid">
            {slice.map((id) => courses[id] && (
              <CourseCard key={id} c={courses[id]} onClick={() => navigate(`/courses/${id}`)} />
            ))}
          </div>
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
        </>
      )}
    </Layout>
  );
}
