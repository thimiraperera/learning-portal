import { useState } from "react";
import { Award, Plus, Eye, Download, Send, LockOpen, CheckCircle, AlertTriangle, Search, X } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

function fmt(ts) { return new Date(Number(ts) || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }

export default function Certificates() {
  const { users, courses, certificates, issueManyCertificates, unlockCertificate, sendCertificate, adminViewCertificate, adminDownloadCertificate } = useStore();

  const [courseF, setCourseF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [batchF, setBatchF] = useState("all");
  const [qy, setQy] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Build one row per student-course pairing (enrolled courses + any issued certificate).
  const rows = [];
  const seen = new Set();
  for (const u of Object.values(users)) {
    if (u.role !== "student") continue;
    for (const cid of u.enrolled) {
      if (!courses[cid]) continue;
      const cert = certificates.find((c) => c.student_id === u.id && c.course_id === cid) || null;
      const batchNumber = (cert && cert.batchNumber != null) ? cert.batchNumber : (u.enrolledBatch ? u.enrolledBatch[cid] : null);
      rows.push({ key: `${u.id}-${cid}`, studentId: u.id, name: u.name, email: u.email, courseId: cid, code: courses[cid].code, title: courses[cid].title, batchNumber, cert });
      seen.add(`${u.id}-${cid}`);
    }
  }
  for (const c of certificates) {
    const k = `${c.student_id}-${c.course_id}`;
    if (!seen.has(k)) rows.push({ key: k, studentId: c.student_id, name: c.studentName, email: c.studentEmail, courseId: c.course_id, code: c.courseCode, title: c.courseTitle, batchNumber: c.batchNumber, cert: c });
  }
  const batchNumbers = [...new Set(rows.map((r) => r.batchNumber).filter((n) => n != null))].sort((a, b) => a - b);

  const ql = qy.trim().toLowerCase();
  const filtered = rows
    .filter((r) => courseF === "all" || r.courseId === courseF)
    .filter((r) => batchF === "all" || String(r.batchNumber) === String(batchF))
    .filter((r) => statusF === "all" || (statusF === "issued" ? r.cert : !r.cert))
    .filter((r) => !ql || r.name.toLowerCase().includes(ql) || r.title.toLowerCase().includes(ql) || r.code.toLowerCase().includes(ql));

  const selectableKeys = filtered.filter((r) => !r.cert).map((r) => r.key);
  const allChecked = selectableKeys.length > 0 && selectableKeys.every((k) => selected.has(k));

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const reset = () => setPage(1);
  const toggle = (k) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allChecked) selectableKeys.forEach((k) => n.delete(k));
    else selectableKeys.forEach((k) => n.add(k));
    return n;
  });

  const issue = async () => {
    const pairs = filtered.filter((r) => !r.cert && selected.has(r.key)).map((r) => ({ studentId: r.studentId, courseId: r.courseId }));
    if (pairs.length === 0) { setMsg({ ok: false, msg: "Select at least one student to certify." }); return; }
    const r = await issueManyCertificates(pairs);
    setMsg(r);
    if (r.ok) setSelected(new Set());
  };

  const act = async (fn) => { try { const r = await fn(); if (r) setMsg(r); } catch (e) { setMsg({ ok: false, msg: e.message }); } };

  const statusBadge = (cert) => {
    if (!cert) return <span className="badge badge-pending">Not issued</span>;
    if (cert.unlocked) return <span className="badge badge-verify">Unlocked</span>;
    if (cert.downloaded) return <span className="badge badge-muted">Downloaded</span>;
    return <span className="badge badge-accepted">Available</span>;
  };

  const courseOptions = Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }));
  const activeFilters = (courseF !== "all") + (statusF !== "all") + (batchF !== "all") + (ql ? 1 : 0);

  return (
    <Layout title="Certificates">
      <div className="page-hero">
        <h1>Certificates</h1>
        <p>Filter students, tick who to certify, and issue. Students download each certificate once; use Unlock for a one-time re-download.</p>
      </div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <SearchSelect style={{ flex: "1 1 220px" }} value={courseF} placeholder="All courses" allLabel="All courses"
            options={courseOptions} onChange={(v) => { setCourseF(v); reset(); }} />
          <select className="form-control" style={{ flex: "0 0 150px" }} value={statusF} onChange={(e) => { setStatusF(e.target.value); reset(); }}>
            <option value="all">All statuses</option>
            <option value="issued">Issued</option>
            <option value="notissued">Not issued</option>
          </select>
          {batchNumbers.length > 0 && (
            <select className="form-control" style={{ flex: "0 0 130px" }} value={batchF} onChange={(e) => { setBatchF(e.target.value); reset(); }}>
              <option value="all">All batches</option>
              {batchNumbers.map((n) => <option key={n} value={n}>Batch {n}</option>)}
            </select>
          )}
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
            <input className="form-control" style={{ paddingLeft: 36, width: "100%" }} placeholder="Search student or course" value={qy} onChange={(e) => { setQy(e.target.value); reset(); }} />
          </div>
          {activeFilters > 0 && <button className="btn btn-ghost btn-sm" onClick={() => { setCourseF("all"); setStatusF("all"); setBatchF("all"); setQy(""); reset(); }}><X /> Clear</button>}
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={issue} disabled={selected.size === 0}>
            <Award /> Issue {selected.size} certificate{selected.size === 1 ? "" : "s"}
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>{filtered.length} row{filtered.length === 1 ? "" : "s"}</div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Award /></div><p>No students match these filters.</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: "center" }}>
                      <input type="checkbox" checked={allChecked} disabled={selectableKeys.length === 0} onChange={toggleAll}
                        style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: selectableKeys.length ? "pointer" : "default" }} />
                    </th>
                    <th>Student</th><th>Course</th><th>Batch</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((r) => (
                    <tr key={r.key} style={{ opacity: r.cert ? 0.85 : 1 }}>
                      <td style={{ textAlign: "center" }}>
                        {r.cert
                          ? <CheckCircle style={{ width: 15, height: 15, color: "#16A34A" }} />
                          : <input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer" }} />}
                      </td>
                      <td><div style={{ fontWeight: 700, color: "var(--title)" }}>{r.name}</div><div style={{ fontSize: 12, color: "#9CA3AF" }}>{r.email}</div></td>
                      <td><span className="cc-code">{r.code}</span> <span style={{ color: "#6B7280", fontSize: 13 }}>{r.title}</span></td>
                      <td style={{ color: "#6B7280", whiteSpace: "nowrap" }}>{r.batchNumber != null ? `Batch ${r.batchNumber}` : "-"}</td>
                      <td>{statusBadge(r.cert)}{r.cert && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{fmt(r.cert.issued_at)}</div>}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {r.cert && <>
                          <button className="icon-btn-plain" title="View" onClick={() => act(() => adminViewCertificate(r.cert.id))}><Eye style={{ width: 16, height: 16 }} /></button>
                          <button className="icon-btn-plain" title="Download" onClick={() => act(() => adminDownloadCertificate(r.cert.id, r.cert.cert_no))}><Download style={{ width: 16, height: 16 }} /></button>
                          <button className="icon-btn-plain" title="Email to student" onClick={() => act(() => sendCertificate(r.cert.id))}><Send style={{ width: 16, height: 16 }} /></button>
                          {r.cert.downloaded && !r.cert.unlocked && (
                            <button className="icon-btn-plain" title="Unlock one re-download" onClick={() => unlockCertificate(r.cert.id)} style={{ color: "var(--primary)" }}><LockOpen style={{ width: 16, height: 16 }} /></button>
                          )}
                        </>}
                      </td>
                    </tr>
                  ))}
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
