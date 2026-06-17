import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Search, X, Eye, Lock, Unlock } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";
import { rs, fmtDate, planBadge } from "../../lib/payments.js";

export default function Payments() {
  const { plans, courses, lockStudent } = useStore();
  const navigate = useNavigate();

  const [busyId, setBusyId] = useState(null);
  const toggleLock = async (p) => {
    const lock = p.studentStatus !== "inactive";
    const msg = lock
      ? `Lock ${p.studentName}'s account? They will not be able to sign in until you unlock it.`
      : `Unlock ${p.studentName}'s account? They will be able to sign in again.`;
    if (!window.confirm(msg)) return;
    setBusyId(p.user_id);
    await lockStudent(p.user_id, lock);
    setBusyId(null);
  };

  const [qy, setQy] = useState("");
  const [course, setCourse] = useState("all");
  const [status, setStatus] = useState("all");
  const [batch, setBatch] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const resetPage = () => setPage(1);

  const batchNumbers = [...new Set(plans.map((p) => p.batchNumber).filter((n) => n != null))].sort((a, b) => a - b);
  const ql = qy.trim().toLowerCase();
  const filtered = plans
    .filter((p) => course === "all" || String(p.course_id) === String(course))
    .filter((p) => batch === "all" || String(p.batchNumber) === String(batch))
    .filter((p) => {
      if (status === "all") return true;
      if (status === "paid") return p.status === "paid";
      if (status === "unpaid") return p.status !== "paid"; // any outstanding balance
      if (status === "overdue") return p.status === "overdue";
      return true;
    })
    .filter((p) => !ql
      || (p.studentName || "").toLowerCase().includes(ql)
      || (p.studentEmail || "").toLowerCase().includes(ql)
      || (p.studentRegNo || "").toLowerCase().includes(ql)
      || (p.courseCode || "").toLowerCase().includes(ql)
      || (p.courseTitle || "").toLowerCase().includes(ql));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeFilters = (course !== "all") + (status !== "all") + (batch !== "all") + (ql ? 1 : 0);

  const totalRemaining = filtered.reduce((n, p) => n + Number(p.remaining || 0), 0);

  return (
    <Layout title="Payments">
      <div className="page-hero">
        <h1>Payments</h1>
        <p>Every student payment plan across all courses. Search, filter, and open a student to record payments.</p>
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
            <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search by student, reg no, email or course"
              value={qy} onChange={(e) => { setQy(e.target.value); resetPage(); }} />
          </div>
          <SearchSelect style={{ flex: "1 1 220px" }} value={course} placeholder="All courses" allLabel="All courses"
            options={Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }))}
            onChange={(v) => { setCourse(v); resetPage(); }} />
          <select className="form-control" style={{ flex: "0 0 160px" }} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            <option value="all">All statuses</option>
            <option value="paid">Fully paid</option>
            <option value="unpaid">Has balance</option>
            <option value="overdue">Overdue</option>
          </select>
          {batchNumbers.length > 0 && (
            <select className="form-control" style={{ flex: "0 0 130px" }} value={batch} onChange={(e) => { setBatch(e.target.value); resetPage(); }}>
              <option value="all">All batches</option>
              {batchNumbers.map((n) => <option key={n} value={n}>Batch {n}</option>)}
            </select>
          )}
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setCourse("all"); setStatus("all"); setBatch("all"); resetPage(); }}>
              <X /> Clear
            </button>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>
          {filtered.length} of {plans.length} plan{plans.length === 1 ? "" : "s"} · outstanding {rs(totalRemaining)}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Wallet /></div><p>{plans.length === 0 ? "No payment plans yet. Set one up from a student's Payments tab." : "No plans match."}</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Student</th><th>Course</th><th>Batch</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Next due</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {slice.map((p) => {
                    const st = planBadge(p.status);
                    return (
                      <tr key={p.id}>
                        <td>
                          <button onClick={() => navigate(`/admin/students/${p.user_id}`)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--primary)", fontFamily: "inherit", fontSize: "inherit", textAlign: "left" }}>
                            {p.studentName}
                          </button>
                          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{p.studentRegNo || p.studentEmail}</div>
                          {p.studentStatus === "inactive" && <span className="badge badge-rejected" style={{ marginTop: 4, display: "inline-block" }}>Account locked</span>}
                        </td>
                        <td style={{ color: "#6B7280" }}>{p.courseCode} - {p.courseTitle}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{p.batchNumber != null ? `Batch ${p.batchNumber}` : "-"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{rs(p.total)}</td>
                        <td style={{ whiteSpace: "nowrap", color: "#16A34A" }}>{rs(p.paid)}</td>
                        <td style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{rs(p.remaining)}</td>
                        <td style={{ color: "#6B7280", whiteSpace: "nowrap" }}>{p.nextDue ? fmtDate(p.nextDue.due_date) : "-"}</td>
                        <td>
                          <span className={"badge " + st.cls}>{st.label}</span>
                          {p.missedCount > 0 && <span className="badge badge-rejected" style={{ marginLeft: 4 }}>{p.missedCount} missed</span>}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {p.studentStatus !== "invited" && (
                            p.studentStatus === "inactive"
                              ? <button className="btn btn-outline btn-sm" style={{ marginRight: 6 }} disabled={busyId === p.user_id}
                                  title="Unlock account" onClick={() => toggleLock(p)}><Unlock /> Unlock</button>
                              : <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} disabled={busyId === p.user_id}
                                  title="Lock account (e.g. unpaid)" onClick={() => toggleLock(p)}><Lock /> Lock</button>
                          )}
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/students/${p.user_id}`)}><Eye /> View</button>
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
