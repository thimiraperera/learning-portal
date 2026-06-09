import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, KeyRound, Users, Settings, LogOut, GraduationCap, UserCog, ChevronDown,
} from "lucide-react";
import { useStore } from "../state.jsx";

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

function initials(name) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/* Sidebar nav differs by role; same chrome as invoice-workflow base.html */
export default function Layout({ title, children }) {
  const { currentUser, courses, brand, logout } = useStore();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === "admin";

  const onLogout = () => { logout(); navigate("/login"); };

  const adminNav = [
    { to: "/admin", label: "Access Control", icon: KeyRound, end: true },
    { to: "/admin/students", label: "Students", icon: Users },
    { to: "/admin/courses", label: "Courses", icon: BookOpen },
    { to: "/admin/settings", label: "Settings", icon: Settings },
    { to: "/account", label: "My Account", icon: UserCog },
  ];

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          {brand.logo
            ? <img src={brand.logo} alt={brand.name || "Logo"} className="brand-logo-img" />
            : (
              <>
                {brand.company && <div className="company">{brand.company}</div>}
                <div className="system">{brand.name || "Learning Portal"}</div>
              </>
            )}
        </div>

        <div className="sidebar-user">
          <div className="avatar">{initials(currentUser.name)}</div>
          <div className="info">
            <div className="name">{currentUser.name}</div>
            <span className="role-badge">{isAdmin ? "Administrator" : "Student"}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Menu</div>
          {isAdmin
            ? adminNav.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end}
                  className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
                  <it.icon className="nav-icon" /> {it.label}
                </NavLink>
              ))
            : (
              <>
                <NavLink to="/" end className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
                  <LayoutDashboard className="nav-icon" /> Dashboard
                </NavLink>
                <CoursesAccordion courses={courses} enrolled={currentUser.enrolled} />
                <NavLink to="/account" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
                  <UserCog className="nav-icon" /> My Account
                </NavLink>
              </>
            )}
        </nav>

        <div className="sidebar-footer">
          <button className="signout-btn" type="button" onClick={onLogout}>
            <LogOut className="nav-icon" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="topbar-title">{title}</div>
          <div className="topbar-date">{today}</div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </>
  );
}

/* Expandable "My Courses" in the sidebar: click to expand/collapse the
   student's enrolled courses; each sub-item opens that course. */
function CoursesAccordion({ courses, enrolled }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" className="nav-item" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <GraduationCap className="nav-icon" /> My Courses
        <ChevronDown className={"nav-chevron" + (open ? " open" : "")} />
      </button>
      {open && (
        <div className="nav-sub">
          {enrolled.length === 0 && <div className="nav-sub-empty">No courses yet</div>}
          {enrolled.map((id) => courses[id] && (
            <NavLink key={id} to={`/courses/${id}`}
              className={({ isActive }) => "nav-subitem" + (isActive ? " active" : "")}>
              {courses[id].title}
            </NavLink>
          ))}
          {enrolled.length > 0 && (
            <NavLink to="/courses" end className={({ isActive }) => "nav-subitem nav-sub-all" + (isActive ? " active" : "")}>
              View all courses
            </NavLink>
          )}
        </div>
      )}
    </div>
  );
}
