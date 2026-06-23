import { useState } from "react";
import { Inbox, Check, X, Search } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import Button from "../../components/Button.jsx";
import { useStore } from "../../state.jsx";

/* Pending course enrolment requests from students. Approve enrols them. */
export default function Requests() {
  const { requests, courses, approveRequest, declineRequest } = useStore();
  const [qy, setQy] = useState("");
  const [course, setCourse] = useState("all");
  const [batchSel, setBatchSel] = useState({}); // requestId -> chosen batch id
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const resetPage = () => setPage(1);

  const ql = qy.trim().toLowerCase();
  const filtered = requests
    .filter((r) => course === "all" || String(r.course_id) === String(course))
    .filter((r) => !ql
      || (r.studentName || "").toLowerCase().includes(ql)
      || (r.studentEmail || "").toLowerCase().includes(ql)
      || (r.courseCode || "").toLowerCase().includes(ql)
      || (r.courseTitle || "").toLowerCase().includes(ql));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeFilters = (course !== "all") + (ql ? 1 : 0);

  return (
    <Layout title="Enrolment requests">
      <div className="page-hero">
        <h1>Enrolment requests</h1>
        <p>Students requesting access to courses. Approve to enrol them, or decline the request.</p>
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
            <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search by student, email or course"
              value={qy} onChange={(e) => { setQy(e.target.value); resetPage(); }} />
          </div>
          <SearchSelect style={{ flex: "1 1 220px" }} value={course} placeholder="All courses" allLabel="All courses"
            options={Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }))}
            onChange={(v) => { setCourse(v); resetPage(); }} />
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQy(""); setCourse("all"); resetPage(); }}>
              <X /> Clear
            </button>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>
          {filtered.length} of {requests.length} pending request{requests.length === 1 ? "" : "s"}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Inbox /></div><p>{requests.length === 0 ? "No pending requests." : "No requests match."}</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Student</th><th>Course</th><th>Requested</th><th></th></tr>
                </thead>
                <tbody>
                  {slice.map((r) => {
                    const cb = courses[r.course_id];
                    const batches = (cb && cb.batches) || [];
                    const sel = batchSel[r.id] || (cb && cb.batchId);
                    return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{r.studentName}</div>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{r.studentEmail}</div>
                      </td>
                      <td style={{ color: "#6B7280" }}>{r.courseCode} - {r.courseTitle}</td>
                      <td style={{ color: "#6B7280", whiteSpace: "nowrap" }}>
                        {new Date(Number(r.created_at)).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {batches.length > 0 && (
                          <select className="form-control" style={{ display: "inline-block", width: "auto", height: 34, padding: "0 8px", fontSize: 12.5, marginRight: 8 }}
                            value={sel || ""} onChange={(e) => setBatchSel((s) => ({ ...s, [r.id]: Number(e.target.value) }))}>
                            {batches.map((b) => <option key={b.id} value={b.id}>Batch {b.number}{b.status === "ended" ? " (ended)" : ""}</option>)}
                          </select>
                        )}
                        <Button className="btn btn-primary btn-sm" style={{ marginRight: 8 }} onClick={() => approveRequest(r.id, sel)}><Check /> Approve</Button>
                        <Button className="btn btn-ghost btn-sm" onClick={() => declineRequest(r.id)}><X /> Decline</Button>
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
