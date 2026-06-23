import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, CheckCircle, AlertTriangle, Users, Mail, Copy, Search, Eye, X } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import Button from "../../components/Button.jsx";
import { useStore } from "../../state.jsx";
import { payFilterBucket } from "../../lib/payments.js";

/* Build a sensible username suggestion from the full name: lowercase, strip
   accents, and join words with a hyphen ("John Doe" becomes "john-doe").
   Admins can still type their own. */
function suggestUsername(name) {
  // NFD splits accented letters into base + combining mark; drop the marks
  // (̀-ͯ) so "Jose" stays "jose", then keep a-z0-9 and hyphenate gaps.
  return name.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")   // spaces / punctuation between words become a hyphen
    .replace(/^-+|-+$/g, "")        // no leading or trailing hyphen
    .slice(0, 24)
    .replace(/-+$/g, "");           // slice may leave a dangling hyphen
}

/* Make a suggestion unique against usernames already in the database: append
   -2, -3, ... and trim the base so the result still fits in 24 characters. */
function uniqueUsername(base, taken) {
  if (!base) return "";
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10000; i++) {
    const suffix = "-" + i;
    const cand = base.slice(0, 24 - suffix.length).replace(/-+$/g, "") + suffix;
    if (!taken.has(cand)) return cand;
  }
  return base;
}

const PAY_COL = {
  overdue: { cls: "badge-rejected", label: "Overdue" },
  balance: { cls: "badge-pending", label: "Has balance" },
  paid: { cls: "badge-accepted", label: "Paid" },
  none: { cls: "badge-muted", label: "No plan" },
};

/* A student's overall payment status across their plans, as filter buckets. */
function buildPayStatus(plans) {
  const byUser = {};
  for (const p of plans) (byUser[p.user_id] ||= []).push(p);
  const out = {};
  for (const uid in byUser) {
    const buckets = byUser[uid].map((p) => payFilterBucket(p.status));
    out[uid] = buckets.includes("overdue") ? "overdue" : buckets.includes("balance") ? "balance" : buckets.includes("paid") ? "paid" : "none";
  }
  return out;
}

export default function Students() {
  const { users, courses, addStudent, removeStudent, plans } = useStore();
  const navigate = useNavigate();
  const payStatusByUser = buildPayStatus(plans);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, msg, link, sent }

  const [qy, setQy] = useState("");
  const [status, setStatus] = useState("all");
  const [course, setCourse] = useState("all");
  const [batch, setBatch] = useState("all");
  const [gender, setGender] = useState("all");
  const [pay, setPay] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [fieldErr, setFieldErr] = useState({});

  const onName = (v) => {
    setName(v);
    setFieldErr((e) => ({ ...e, name: undefined }));
    if (!usernameEdited) {
      const taken = new Set(Object.values(users).map((u) => (u.username || "").toLowerCase()).filter(Boolean));
      setUsername(uniqueUsername(suggestUsername(v), taken));
    }
  };

  const invite = async () => {
    const er = {};
    if (!name.trim()) er.name = "Enter the student's full name.";
    if (!email.trim()) er.email = "Email is required to send the invite.";
    else if (!email.includes("@")) er.email = "Enter a valid email address.";
    if (!username.trim()) er.username = "Username is required.";
    setFieldErr(er);
    setMsg(null);
    if (Object.keys(er).length > 0) return;
    const r = await addStudent(name, email, username);
    setMsg(r);
    if (r.ok) { setName(""); setEmail(""); setUsername(""); setUsernameEdited(false); setFieldErr({}); }
  };

  const ql = qy.trim().toLowerCase();
  const all = Object.entries(users).filter(([, u]) => u.role === "student");
  const batchOptions = course !== "all"
    ? ((courses[course] && courses[course].batches) || []).map((b) => b.number)
    : [...new Set(all.flatMap(([, s]) => Object.values(s.enrolledBatch || {})))].sort((a, b) => a - b);
  const filtered = all
    .filter(([, s]) => status === "all" || s.status === status)
    .filter(([, s]) => course === "all" || s.enrolled.includes(course))
    .filter(([, s]) => batch === "all" || (course !== "all"
      ? s.enrolledBatch && s.enrolledBatch[course] === Number(batch)
      : Object.values(s.enrolledBatch || {}).includes(Number(batch))))
    .filter(([, s]) => gender === "all" || s.gender === gender)
    .filter(([, s]) => pay === "all" || (payStatusByUser[s.id] || "none") === pay)
    .filter(([e, s]) => !ql || s.name.toLowerCase().includes(ql) || e.toLowerCase().includes(ql) || (s.username || "").toLowerCase().includes(ql));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const resetPage = () => setPage(1);
  const activeFilters = (status !== "all") + (course !== "all") + (batch !== "all") + (gender !== "all") + (pay !== "all") + (ql ? 1 : 0);

  return (
    <Layout title="Students">
      <div className="page-hero">
        <h1>Students</h1>
        <p>Invite a student by email. They receive a registration link to confirm their details and set a password.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Invite a student</div>
        <div className="card-subtitle">No password is set here. The student creates it from the registration link.</div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Full name <span className="req">*</span></label>
          <input className={"form-control" + (fieldErr.name ? " is-invalid" : "")} style={{ width: "100%" }} placeholder="Full name" value={name} onChange={(e) => onName(e.target.value)} />
          {fieldErr.name && <div className="field-error">{fieldErr.name}</div>}
        </div>
        <div className="toolbar" style={{ marginBottom: 0, alignItems: "flex-end" }}>
          <div className="tb-field" style={{ flex: "1 1 180px" }}>
            <label className="form-label">Email <span className="req">*</span></label>
            <input className={"form-control" + (fieldErr.email ? " is-invalid" : "")} style={{ width: "100%" }} placeholder="email@address.com" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErr((er) => ({ ...er, email: undefined })); }} />
            {fieldErr.email && <div className="field-error">{fieldErr.email}</div>}
          </div>
          <div className="tb-field" style={{ flex: "1 1 180px" }}>
            <label className="form-label">Username <span className="req">*</span></label>
            <input className={"form-control" + (fieldErr.username ? " is-invalid" : "")} style={{ width: "100%" }} placeholder="Username" value={username} onChange={(e) => { setUsername(e.target.value); setUsernameEdited(true); setFieldErr((er) => ({ ...er, username: undefined })); }} />
            {fieldErr.username && <div className="field-error">{fieldErr.username}</div>}
          </div>
          <Button className="btn btn-primary" onClick={invite}><Mail /> Send invite</Button>
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8 }}>A unique username is suggested from the full name (words joined with a hyphen). You can change it before sending.</div>
        {msg && (
          <>
            <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")} style={{ marginTop: 16, marginBottom: msg.link ? 8 : 0 }}>
              {msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}
            </div>
            {msg.link && (
              <div className="invite-link">
                <code>{msg.link}</code>
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(msg.link)}><Copy /> Copy</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
            <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search by name, email or username"
              value={qy} onChange={(e) => { setQy(e.target.value); resetPage(); }} />
          </div>
          <select className="form-control" style={{ flex: "0 0 150px" }} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="invited">Invited</option>
          </select>
          <SearchSelect style={{ flex: "1 1 220px" }} value={course} placeholder="All courses" allLabel="All courses"
            options={Object.entries(courses).map(([cid, c]) => ({ value: cid, label: c.title }))}
            onChange={(v) => { setCourse(v); setBatch("all"); resetPage(); }} />
          {batchOptions.length > 0 && (
            <select className="form-control" style={{ flex: "0 0 130px" }} value={batch} onChange={(e) => { setBatch(e.target.value); resetPage(); }}>
              <option value="all">All batches</option>
              {batchOptions.map((n) => <option key={n} value={n}>Batch {n}</option>)}
            </select>
          )}
          <select className="form-control" style={{ flex: "0 0 150px" }} value={gender} onChange={(e) => { setGender(e.target.value); resetPage(); }}>
            <option value="all">Any gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <select className="form-control" style={{ flex: "0 0 160px" }} value={pay} onChange={(e) => { setPay(e.target.value); resetPage(); }}>
            <option value="all">Any payment</option>
            <option value="overdue">Overdue</option>
            <option value="balance">Has balance</option>
            <option value="paid">Fully paid</option>
            <option value="none">No plan</option>
          </select>
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setStatus("all"); setCourse("all"); setBatch("all"); setGender("all"); setPay("all"); resetPage(); }}>
              <X /> Clear
            </button>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>{filtered.length} of {all.length} students</div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Users /></div><p>No students match.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Student</th><th>Username</th><th>Gender</th><th>Status</th><th>Payment</th><th></th></tr>
                </thead>
                <tbody>
                  {slice.map(([email, s]) => {
                    const pc = PAY_COL[payStatusByUser[s.id] || "none"];
                    return (
                    <tr key={email}>
                      <td>
                        <button onClick={() => navigate(`/admin/students/${s.id}`)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--primary)", fontFamily: "inherit", fontSize: "inherit", textAlign: "left" }}>
                          {s.name}
                        </button>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{email}</div>
                      </td>
                      <td style={{ color: "#6B7280" }}>{s.username}</td>
                      <td style={{ color: "#6B7280" }}>{s.gender || "-"}</td>
                      <td><span className={"badge " + (s.status === "active" ? "badge-accepted" : "badge-pending")}>{s.status}</span></td>
                      <td><span className={"badge " + pc.cls}>{pc.label}</span></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/students/${s.id}`)} style={{ marginRight: 8 }}>
                          <Eye /> View
                        </button>
                        <button className="icon-btn-plain" title="Remove" onClick={() => removeStudent(email)}>
                          <Trash2 style={{ width: 16, height: 16 }} />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
              pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={filtered.length} />
          </>
        )}
      </div>
    </Layout>
  );
}
