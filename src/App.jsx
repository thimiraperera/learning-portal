import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StoreProvider, useStore } from "./state.jsx";
import { PopupProvider } from "./components/Popup.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Setup from "./pages/Setup.jsx";
import Forgot from "./pages/Forgot.jsx";
import Reset from "./pages/Reset.jsx";
import Account from "./pages/Account.jsx";
import Dashboard from "./pages/student/Dashboard.jsx";
import MyCourses from "./pages/student/MyCourses.jsx";
import CourseDetail from "./pages/student/CourseDetail.jsx";
import Browse from "./pages/student/Browse.jsx";
import Students from "./pages/admin/Students.jsx";
import StudentManage from "./pages/admin/StudentManage.jsx";
import Courses from "./pages/admin/Courses.jsx";
import CourseManage from "./pages/admin/CourseManage.jsx";
import Instructors from "./pages/admin/Instructors.jsx";
import InstructorManage from "./pages/admin/InstructorManage.jsx";
import Certificates from "./pages/admin/Certificates.jsx";
import Backup from "./pages/admin/Backup.jsx";
import Settings from "./pages/admin/Settings.jsx";
import Requests from "./pages/admin/Requests.jsx";
import Payments from "./pages/admin/Payments.jsx";
import Exams from "./pages/admin/Exams.jsx";
import ExamManage from "./pages/admin/ExamManage.jsx";
import ExamTake from "./pages/student/ExamTake.jsx";
import InstructorDashboard from "./pages/instructor/Dashboard.jsx";
import InstructorCourseView from "./pages/instructor/CourseView.jsx";

const HOME_FOR = { admin: "/admin", instructor: "/instructor", student: "/" };

/* Route guards keyed off the logged-in user's role. */
function RequireRole({ role, children }) {
  const { currentUser } = useStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== role) {
    return <Navigate to={HOME_FOR[currentUser.role] || "/"} replace />;
  }
  return children;
}

/* Super administrators only (admin Settings). Local admins are sent to their
   default admin page. */
function RequireSuper({ children }) {
  const { currentUser } = useStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== "admin" || !currentUser.superAdmin) {
    return <Navigate to={HOME_FOR[currentUser.role] || "/"} replace />;
  }
  return children;
}

/* Any signed-in user (used by the shared account page). */
function RequireAuth({ children }) {
  const { currentUser } = useStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
}

function Routed() {
  const { ready } = useStore();
  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#9CA3AF", fontFamily: "'Figtree', sans-serif", fontWeight: 600 }}>
        Loading...
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset" element={<Reset />} />

      {/* student */}
      <Route path="/" element={<RequireRole role="student"><Dashboard /></RequireRole>} />
      <Route path="/courses" element={<RequireRole role="student"><MyCourses /></RequireRole>} />
      <Route path="/courses/:id" element={<RequireRole role="student"><CourseDetail /></RequireRole>} />
      <Route path="/browse" element={<RequireRole role="student"><Browse /></RequireRole>} />
      <Route path="/exams/:id" element={<RequireRole role="student"><ExamTake /></RequireRole>} />

      {/* instructor */}
      <Route path="/instructor" element={<RequireRole role="instructor"><InstructorDashboard /></RequireRole>} />
      <Route path="/instructor/courses/:id" element={<RequireRole role="instructor"><InstructorCourseView /></RequireRole>} />

      {/* shared */}
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />

      {/* admin */}
      <Route path="/admin" element={<RequireRole role="admin"><Navigate to="/admin/students" replace /></RequireRole>} />
      <Route path="/admin/students" element={<RequireRole role="admin"><Students /></RequireRole>} />
      <Route path="/admin/students/:id" element={<RequireRole role="admin"><StudentManage /></RequireRole>} />
      <Route path="/admin/courses" element={<RequireRole role="admin"><Courses /></RequireRole>} />
      <Route path="/admin/courses/:id" element={<RequireRole role="admin"><CourseManage /></RequireRole>} />
      <Route path="/admin/instructors" element={<RequireRole role="admin"><Instructors /></RequireRole>} />
      <Route path="/admin/instructors/:id" element={<RequireRole role="admin"><InstructorManage /></RequireRole>} />
      <Route path="/admin/requests" element={<RequireRole role="admin"><Requests /></RequireRole>} />
      <Route path="/admin/payments" element={<RequireRole role="admin"><Payments /></RequireRole>} />
      <Route path="/admin/exams" element={<RequireRole role="admin"><Exams /></RequireRole>} />
      <Route path="/admin/exams/:id" element={<RequireRole role="admin"><ExamManage /></RequireRole>} />
      <Route path="/admin/certificates" element={<RequireRole role="admin"><Certificates /></RequireRole>} />
      <Route path="/admin/backup" element={<RequireRole role="admin"><Backup /></RequireRole>} />
      <Route path="/admin/settings" element={<RequireSuper><Settings /></RequireSuper>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <PopupProvider>
          <Routed />
        </PopupProvider>
      </BrowserRouter>
    </StoreProvider>
  );
}
