import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, KeyRound, Users, Settings, LogOut, GraduationCap, UserCog,
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
  const { currentUser, brand, logout } = useStore();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === "admin";

  const onLogout = () => { logout(); navigate("/login"); };

  const studentNav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/courses", label: "My Courses", icon: GraduationCap },
    { to: "/account", label: "My Account", icon: UserCog },
  ];
  const adminNav = [
    { to: "/admin", label: "Access Control", icon: KeyRound, end: true },
    { to: "/admin/students", label: "Students", icon: Users },
    { to: "/admin/courses", label: "Courses", icon: BookOpen },
    { to: "/admin/settings", label: "Settings", icon: Settings },
    { to: "/account", label: "My Account", icon: UserCog },
  ];
  const items = isAdmin ? adminNav : studentNav;

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
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              <it.icon className="nav-icon" /> {it.label}
            </NavLink>
          ))}
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
