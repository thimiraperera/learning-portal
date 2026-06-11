import { useState } from "react";
import { Award, Plus, Eye, Download, Send, LockOpen, CheckCircle, AlertTriangle, Search } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Pagination from "../../components/Pagination.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

function fmt(ts) { return new Date(Number(ts) || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }

export default function Certificates() {
  const store = useStore();
  const { users, courses, certificates, issueCertificate, bulkIssueCertificates, unlockCertificate, sendCertificate, adminViewCertificate, adminDownloadCertificate } = store;

  const [student, setStudent] = useState("all");
  const [course, setCourse] = useState("all");
  const [bulkCourse, setBulkCourse] = useState("all");
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkSearch, setBulkSearch] = useState("");
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const hasCert = (studentId, courseId) => certificates.some((c) => c.student_id === studentId && c.course_id === courseId);

  const studentOptions = Object.values(users).filter((u) => u.role === "student").map((u) => ({ value: String(u.id), label: `${u.name} · ${u.email}` }));
  const courseOptions = Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }));

  // Course options for the picked student: their enrolled courses without a certificate yet.
  const selStudent = student !== "all" ? Object.values(users).find((u) => String(u.id) === student) : null;
  const studentCourseOptions = selStudent
    ? selStudent.enrolled.filter((cid) => courses[cid] && !hasCert(selStudent.id, cid)).map((cid) => ({ value: cid, label: `${courses[cid].code} - ${courses[cid].title}` }))
    : [];

  // All students enrolled in the picked course (certified ones are shown but not selectable).
  const bulkStudents = bulkCourse !== "all"
    ? Object.values(users).filter((u) => u.role === "student" && u.enrolled.includes(bulkCourse))
    : [];
  const eligibleIds = (cid) => Object.values(users).filter((u) => u.role === "student" && u.enrolled.includes(cid) && !hasCert(u.id, cid)).map((u) => u.id);
  const bq = bulkSearch.trim().toLowerCase();
  const bulkVisible = bulkStudents.filter((u) => !bq || u.name.toLowerCase().includes(bq) || u.email.toLowerCase().includes(bq));
  const eligibleVisible = bulkVisible.filter((u) => !hasCert(u.id, bulkCourse));
  const allEligibleChecked = eligibleVisible.length > 0 && eligibleVisible.every((u) => bulkSelected.has(u.id));

  const onStudent = (v) => { setStudent(v); setCourse("all"); };

  // Selecting a course pre-checks every eligible student.
  const onBulkCourse = (v) => {
    setBulkCourse(v);
    setBulkSearch("");
    setBulkSelected(v === "all" ? new Set() : new Set(eligibleIds(v)));
  };
  const toggleStudent = (id) => setBulkSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setBulkSelected((s) => {
    const n = new Set(s);
    if (allEligibleChecked) eligibleVisible.forEach((u) => n.delete(u.id));
    else eligibleVisible.forEach((u) => n.add(u.id));
    return n;
  });

  const issue = async () => {
    if (student === "all" || course === "all") { setMsg({ ok: false, msg: "Pick a student and a course." }); return; }
    const r = await issueCertificate(Number(student), course);
    setMsg(r);
    if (r.ok) { setStudent("all"); setCourse("all"); }
  };

  const bulkIssue = async () => {
    if (bulkCourse === "all" || bulkSelected.size === 0) { setMsg({ ok: false, msg: "Pick a course and at least one student." }); return; }
    const r = await bulkIssueCertificates(bulkCourse, [...bulkSelected]);
    setMsg(r);
    if (r.ok) setBulkSelected(new Set());
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

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Issue to one student</div>
        <div className="card-subtitle">Pick a student, then choose from the courses they're enrolled in. The student is emailed and can download it once.</div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <SearchSelect style={{ flex: "1 1 240px" }} value={student} placeholder="Select student" allLabel="Select student"
            options={studentOptions} onChange={onStudent} />
          <SearchSelect style={{ flex: "1 1 240px" }} value={course}
            placeholder={selStudent ? (studentCourseOptions.length ? "Select course" : "No courses to certify") : "Select a student first"}
            allLabel="Select course" options={studentCourseOptions} onChange={setCourse} />
          <button className="btn btn-primary" onClick={issue} disabled={student === "all" || course === "all"}><Plus /> Issue certificate</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Issue by course</div>
        <div className="card-subtitle">Pick a course to list its students. All eligible students are pre-selected; uncheck anyone you want to skip.</div>
        <div className="toolbar" style={{ marginBottom: bulkCourse !== "all" ? 14 : 0 }}>
          <SearchSelect style={{ flex: "1 1 260px" }} value={bulkCourse} placeholder="Select course" allLabel="Select course"
            options={courseOptions} onChange={onBulkCourse} />
          <button className="btn btn-primary" onClick={bulkIssue} disabled={bulkSelected.size === 0}>
            <Plus /> Issue {bulkSelected.size} certificate{bulkSelected.size === 1 ? "" : "s"}
          </button>
        </div>

        {bulkCourse !== "all" && (
          bulkStudents.length === 0 ? (
            <p style={{ color: "#9CA3AF", fontSize: 13 }}>No students are enrolled in this course.</p>
          ) : (
            <>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
                <input className="form-control" style={{ paddingLeft: 36, width: "100%", height: 40 }} placeholder="Search students" value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)} />
              </div>
              {eligibleVisible.length > 0 && (
                <label className="check-row" style={{ padding: "6px 2px", borderBottom: "1px solid var(--border)" }}>
                  <input type="checkbox" checked={allEligibleChecked} onChange={toggleAll} /> Select all ({eligibleVisible.length})
                </label>
              )}
              <div style={{ maxHeight: 280, overflowY: "auto", marginTop: 4 }}>
                {bulkVisible.map((u) => {
                  const certified = hasCert(u.id, bulkCourse);
                  return (
                    <label key={u.id} className="check-row" style={{ padding: "9px 2px", opacity: certified ? 0.6 : 1 }}>
                      <input type="checkbox" disabled={certified} checked={certified ? false : bulkSelected.has(u.id)} onChange={() => toggleStudent(u.id)} />
                      <span style={{ fontWeight: 600, color: "var(--title)" }}>{u.name}</span>
                      <span style={{ color: "#9CA3AF", fontSize: 12.5 }}>{u.email}</span>
                      {certified && <span className="badge badge-muted" style={{ marginLeft: "auto" }}>Already issued</span>}
                    </label>
                  );
                })}
                {bulkVisible.length === 0 && <p style={{ color: "#9CA3AF", fontSize: 13 }}>No students match.</p>}
              </div>
            </>
          )
        )}
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
