import { useState } from "react";
import { Award, Plus, Eye, Download, Send, LockOpen, CheckCircle, AlertTriangle } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

function fmt(ts) { return new Date(Number(ts) || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }

export default function Certificates() {
  const store = useStore();
  const { users, courses, certificates, issueCertificate, unlockCertificate, sendCertificate, adminViewCertificate, adminDownloadCertificate } = store;

  const [student, setStudent] = useState("all");
  const [course, setCourse] = useState("all");
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const studentOptions = Object.values(users).filter((u) => u.role === "student").map((u) => ({ value: String(u.id), label: `${u.name} · ${u.email}` }));
  const courseOptions = Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }));

  const issue = async () => {
    if (student === "all" || course === "all") { setMsg({ ok: false, msg: "Pick a student and a course." }); return; }
    const r = await issueCertificate(Number(student), course);
    setMsg(r);
    if (r.ok) { setStudent("all"); setCourse("all"); }
  };

  const act = async (fn) => { try { const r = await fn(); if (r) setMsg(r); } catch (e) { setMsg({ ok: false, msg: e.message }); } };

  const pageCount = Math.max(1, Math.ceil(certificates.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = certificates.slice((safePage - 1) * pageSize, safePage * pageSize);

  const statusBadge = (c) => {
    if (c.unlocked) return <span className="badge badge-verify">Unlocked</span>;
    if (c.downloaded) return <span className="badge badge-muted">Downloaded</span>;
    return <span className="badge badge-accepted">Available</span>;
  };

  return (
    <Layout title="Certificates">
      <div className="page-hero">
        <h1>Certificates</h1>
        <p>Issue course-completion certificates, email them, and manage student downloads.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Issue a certificate</div>
        <div className="card-subtitle">The student is emailed and can download it once from their dashboard.</div>
        {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <SearchSelect style={{ flex: "1 1 240px" }} value={student} placeholder="Select student" allLabel="Select student"
            options={studentOptions} onChange={setStudent} />
          <SearchSelect style={{ flex: "1 1 240px" }} value={course} placeholder="Select course" allLabel="Select course"
            options={courseOptions} onChange={setCourse} />
          <button className="btn btn-primary" onClick={issue}><Plus /> Issue certificate</button>
        </div>
      </div>

      <div className="card">
        <div className="alert alert-warning" style={{ marginBottom: 18 }}>
          <AlertTriangle />
          <span>Students can download each certificate <strong>once</strong>. Use <strong>Unlock</strong> to grant a one-time re-download in an emergency.</span>
        </div>

        {certificates.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Award /></div><p>No certificates issued yet.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Certificate</th><th>Student</th><th>Course</th><th>Issued</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {slice.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.cert_no}</td>
                      <td><div style={{ fontWeight: 700, color: "var(--title)" }}>{c.studentName}</div><div style={{ fontSize: 12, color: "#9CA3AF" }}>{c.studentEmail}</div></td>
                      <td>{c.courseCode}</td>
                      <td style={{ color: "#6B7280", fontSize: 13 }}>{fmt(c.issued_at)}</td>
                      <td>{statusBadge(c)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="icon-btn-plain" title="View" onClick={() => act(() => adminViewCertificate(c.id))}><Eye style={{ width: 16, height: 16 }} /></button>
                        <button className="icon-btn-plain" title="Download" onClick={() => act(() => adminDownloadCertificate(c.id, c.cert_no))}><Download style={{ width: 16, height: 16 }} /></button>
                        <button className="icon-btn-plain" title="Email to student" onClick={() => act(() => sendCertificate(c.id))}><Send style={{ width: 16, height: 16 }} /></button>
                        {c.downloaded && !c.unlocked && (
                          <button className="icon-btn-plain" title="Unlock one re-download" onClick={() => unlockCertificate(c.id)} style={{ color: "var(--primary)" }}><LockOpen style={{ width: 16, height: 16 }} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} pageCount={pageCount} onChange={setPage}
              pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} total={certificates.length} />
          </>
        )}
      </div>
    </Layout>
  );
}
