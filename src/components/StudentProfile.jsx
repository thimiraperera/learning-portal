import { X, Mail, BookOpen, BadgeCheck } from "lucide-react";

/* Small student profile shown as a modal overlay.
   `student` is [email, data]; `courses` is the courses map for titles. */
export default function StudentProfile({ student, courses, onClose }) {
  if (!student) return null;
  const [email, s] = student;
  const initials = s.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X /></button>

        <div className="sp-head">
          <div className="sp-avatar">{initials}</div>
          <div>
            <div className="sp-name">{s.name}</div>
            <span className={"badge " + (s.status === "active" ? "badge-accepted" : "badge-pending")}>{s.status}</span>
          </div>
        </div>

        <div className="sp-rows">
          <div className="sp-row"><BadgeCheck /> <span>Username</span><b>{s.username}</b></div>
          <div className="sp-row"><Mail /> <span>Email</span><b>{email}</b></div>
          <div className="sp-row"><BookOpen /> <span>Enrolled</span><b>{s.enrolled.length} course{s.enrolled.length === 1 ? "" : "s"}</b></div>
        </div>

        {s.enrolled.length > 0 && (
          <div className="sp-courses">
            <div className="sp-courses-label">Courses</div>
            {s.enrolled.map((id) => courses[id] && (
              <div key={id} className="sp-course"><span className="cc-code">{courses[id].code}</span> {courses[id].title}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
