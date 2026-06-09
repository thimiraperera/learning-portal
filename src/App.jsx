import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StoreProvider, useStore } from "./state.jsx";
import Login from "./pages/Login.jsx";
import Account from "./pages/Account.jsx";
import Dashboard from "./pages/student/Dashboard.jsx";
import MyCourses from "./pages/student/MyCourses.jsx";
import CourseDetail from "./pages/student/CourseDetail.jsx";
import Access from "./pages/admin/Access.jsx";
import Students from "./pages/admin/Students.jsx";
import Courses from "./pages/admin/Courses.jsx";
import CourseManage from "./pages/admin/CourseManage.jsx";
import Settings from "./pages/admin/Settings.jsx";

/* Route guards keyed off the logged-in user's role. */
function RequireRole({ role, children }) {
  const { currentUser } = useStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== role) {
    return <Navigate to={currentUser.role === "admin" ? "/admin" : "/"} replace />;
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

      {/* student */}
      <Route path="/" element={<RequireRole role="student"><Dashboard /></RequireRole>} />
      <Route path="/courses" element={<RequireRole role="student"><MyCourses /></RequireRole>} />
      <Route path="/courses/:id" element={<RequireRole role="student"><CourseDetail /></RequireRole>} />

      {/* shared */}
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />

      {/* admin */}
      <Route path="/admin" element={<RequireRole role="admin"><Access /></RequireRole>} />
      <Route path="/admin/students" element={<RequireRole role="admin"><Students /></RequireRole>} />
      <Route path="/admin/courses" element={<RequireRole role="admin"><Courses /></RequireRole>} />
      <Route path="/admin/courses/:id" element={<RequireRole role="admin"><CourseManage /></RequireRole>} />
      <Route path="/admin/settings" element={<RequireRole role="admin"><Settings /></RequireRole>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </StoreProvider>
  );
}
