import { useState } from "react";
import { Inbox, Check, X } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import { useStore } from "../../state.jsx";

/* Pending course enrolment requests from students. Approve enrols them. */
export default function Requests() {
  const { requests, approveRequest, declineRequest } = useStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const pageCount = Math.max(1, Math.ceil(requests.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = requests.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <Layout title="Enrolment requests">
      <div className="page-hero">
        <h1>Enrolment requests</h1>
        <p>Students requesting access to courses. Approve to enrol them, or decline the request.</p>
      </div>

      <div className="card">
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>{requests.length} pending request{requests.length === 1 ? "" : "s"}</div>
        {requests.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Inbox /></div><p>No pending requests.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Student</th><th>Course</th><th>Requested</th><th></th></tr>
                </thead>
                <tbody>
                  {slice.map((r) => (
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
                        <button className="btn btn-primary btn-sm" style={{ marginRight: 8 }} onClick={() => approveRequest(r.id)}><Check /> Approve</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => declineRequest(r.id)}><X /> Decline</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
              pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={requests.length} />
          </>
        )}
      </div>
    </Layout>
  );
}
