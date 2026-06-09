import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StoreProvider, useStore } from "./state.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/student/Dashboard.jsx";
import CourseDetail from "./pages/student/CourseDetail.jsx";
import Access from "./pages/admin/Access.jsx";
import Students from "./pages/admin/Students.jsx";
import Courses from "./pages/admin/Courses.jsx";
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

function Routed() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* student */}
      <Route path="/" element={<RequireRole role="student"><Dashboard /></RequireRole>} />
      <Route path="/courses/:id" element={<RequireRole role="student"><CourseDetail /></RequireRole>} />

      {/* admin */}
      <Route path="/admin" element={<RequireRole role="admin"><Access /></RequireRole>} />
      <Route path="/admin/students" element={<RequireRole role="admin"><Students /></RequireRole>} />
      <Route path="/admin/courses" element={<RequireRole role="admin"><Courses /></RequireRole>} />
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
