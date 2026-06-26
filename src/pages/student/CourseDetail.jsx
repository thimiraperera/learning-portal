import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, PlayCircle, Link2, FileDown, Clock, FileQuestion, Play, Lock, Wallet, RotateCcw, Award, Download, CheckCircle, AlertTriangle, Info, Copy, Check,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Button from "../../components/Button.jsx";
import { useStore } from "../../state.jsx";
import { rs, fmtDate, instBadge, allocatePayments } from "../../lib/payments.js";

/* Open a user-entered URL safely in a new tab, adding https:// if missing. */
export function openUrl(u) {
  if (!u) return;
  const href = /^https?:\/\//i.test(u) ? u : "https://" + u;
  window.open(href, "_blank", "noopener,noreferrer");
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, courses, exams, downloadMaterial, paymentLocked, logActivity, payments, certificates, downloadCertificate, requestCertRedownload } = useStore();
  const [tab, setTab] = useState("recordings");
  const [showDesc, setShowDesc] = useState(false);
  // Start every tab at the top of the page (long content can leave you scrolled down).
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  // Close the description popup with Escape.
  useEffect(() => {
    if (!showDesc) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setShowDesc(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDesc]);

  // Guard: never render a course the student isn't enrolled in.
  if (!currentUser.enrolled.includes(id)) return <Navigate to="/" replace />;
  const c = courses[id];
  const isLocked = (paymentLocked || []).includes(id);
  const myExams = isLocked ? [] : exams.filter((x) => x.course_id === id);
  const myPlan = (payments || []).find((p) => p.course_id === id) || null;
  const myCert = (certificates || []).find((c2) => c2.course_id === id) || null;

  const tabs = [
    { k: "recordings", label: "Recordings", icon: PlayCircle, n: c.recordings.length },
    { k: "links", label: "Course links", icon: Link2, n: c.links.length },
    { k: "materials", label: "Materials", icon: FileDown, n: c.materials.length },
    { k: "payments", label: "Payments", icon: Wallet, n: myPlan ? myPlan.installments.length : 0 },
    { k: "certificate", label: "Certificate", icon: Award, n: myCert ? 1 : 0 },
    ...(myExams.length > 0 ? [{ k: "exam", label: "Exams", icon: FileQuestion, n: myExams.length }] : []),
  ];

  return (
    <Layout title="Course">
      <button className="back-link" onClick={() => navigate("/")}>
        <ArrowLeft /> All courses
      </button>

      <div className="page-hero">
        {/* Course code hidden for now: <div className="ph-code">{c.code}</div> */}
        <h1 style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {c.title}
          {c.blurb && (
            <button type="button" className="icon-btn-plain" title="About this course" onClick={() => setShowDesc(true)}
              style={{ color: "var(--primary)", verticalAlign: "middle" }}>
              <Info style={{ width: 20, height: 20 }} />
            </button>
          )}
        </h1>
      </div>

      {isLocked && (
        <div className="card" style={{ marginBottom: 18, borderLeft: "4px solid var(--danger)" }}>
          <div className="card-title" style={{ color: "var(--danger)" }}><Lock style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6 }} /> Course access locked</div>
          <div className="card-subtitle" style={{ marginBottom: 0 }}>Access to this course is currently locked. This usually means a payment is outstanding. Please settle your balance or contact your administrator to restore access.</div>
        </div>
      )}

      {!isLocked && (
      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> <span className="tab-label">{t.label}</span> {t.n != null && <span className="tab-count">{t.n}</span>}
            </button>
          ))}
        </div>

        {tab === "recordings" && (
          c.recordings.length === 0
            ? <div className="empty-state"><div className="empty-icon"><PlayCircle /></div><p>No recordings have been published yet.</p></div>
            : c.recordings.map((r) => (
                <MediaRow key={`r${r.id}`} icon={PlayCircle} title={r.t} locked={r.locked} lockLabel={r.lockLabel}
                  action={r.u ? "Watch" : null} onAction={r.u ? () => { logActivity("recording", r.t); openUrl(r.u); } : null}
                  linkPassword={r.pw} />
              ))
        )}

        {tab === "links" && (
          c.links.length === 0
            ? <div className="empty-state"><div className="empty-icon"><Link2 /></div><p>No course links have been added yet.</p></div>
            : c.links.map((r) => (
                <MediaRow key={`l${r.id}`} icon={Link2} title={r.t} locked={r.locked} lockLabel={r.lockLabel}
                  action={r.u ? "Open" : null} onAction={r.u ? () => { logActivity("link", r.t); openUrl(r.u); } : null} />
              ))
        )}

        {tab === "materials" && (
          c.materials.length === 0
            ? <div className="empty-state"><div className="empty-icon"><FileDown /></div><p>No materials have been added yet.</p></div>
            : c.materials.map((r) => (
                <MediaRow key={`m${r.id}`} icon={FileDown} title={r.t} locked={r.locked} lockLabel={r.lockLabel}
                  action={r.filename ? "Download" : (r.u ? "Open" : null)}
                  onAction={r.filename ? () => downloadMaterial(r.id, r.t) : (r.u ? () => { logActivity("material_link", r.t); openUrl(r.u); } : null)}
                  meta={r.filename ? <><span className="ext-tag">{r.ext}</span> {r.size}</> : null} />
              ))
        )}

        {tab === "payments" && <PaymentsView plan={myPlan} />}

        {tab === "certificate" && <CertificateView cert={myCert} plan={myPlan} download={downloadCertificate} requestRedownload={requestCertRedownload} />}

        {tab === "exam" && myExams.map((x) => {
          const served = x.question_count > 0 ? Math.min(x.question_count, x.bankSize) : x.bankSize;
          const done = x.attempt && x.attempt.finished_at;
          const canRetake = done && (Number(x.attempt_limit ?? 0) === 0 || (x.attemptsUsed || 0) < Number(x.attempt_limit));
          return (
            <div key={x.id} className="media-row">
              <div className="mr-icon"><FileQuestion /></div>
              <div className="mr-body">
                <div className="mr-title">{x.title}</div>
                <div className="mr-meta">
                  {served} question{served === 1 ? "" : "s"}
                  {x.time_limit > 0 && <><span className="dot" /> <Clock /> {x.time_limit} min</>}
                  {x.paymentLocked && !done && <><span className="dot" /> <Lock style={{ width: 12, height: 12 }} /> {x.lockReason}</>}
                </div>
              </div>
              <div className="mr-actions">
                {done
                  ? (
                    <>
                      <span className="badge badge-accepted">Score {parseFloat(Number(x.attempt.score).toFixed(2))}/{x.attempt.total}</span>
                      {canRetake && !x.paymentLocked && (
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/exams/${x.id}`)}><RotateCcw style={{ width: 14, height: 14 }} /> Retake</button>
                      )}
                    </>
                  )
                  : x.paymentLocked
                    ? <span className="badge badge-muted" title={x.lockReason}><Lock style={{ width: 13, height: 13, verticalAlign: "-2px", marginRight: 4 }} /> Locked</span>
                    : (
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/exams/${x.id}`)}>
                        <Play /> {x.attempt ? "Resume" : "Start exam"}
                      </button>
                    )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {showDesc && (
        <div className="popup-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowDesc(false); }}>
          <div className="popup-card" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
            <div className="popup-head">
              <span className="popup-icon info"><Info /></span>
              <div className="popup-title">{c.title}</div>
            </div>
            <div className="course-blurb" style={{ marginBottom: 18, maxHeight: "60vh", overflowY: "auto" }}
              dangerouslySetInnerHTML={{ __html: c.blurb || "No description has been added for this course yet." }} />
            <div className="popup-actions">
              <button className="btn btn-primary" onClick={() => setShowDesc(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* The student's own read-only view of their payment schedule for this course:
   one row per installment with the payment(s) that funded it shown inside. */
function PaymentsView({ plan }) {
  if (!plan) return <div className="empty-state"><div className="empty-icon"><Wallet /></div><p>No payment plan has been set for this course yet.</p></div>;
  const alloc = allocatePayments(plan.installments, plan.payments);
  const dstr = (ms) => fmtDate(new Date(Number(ms)).toISOString().slice(0, 10));
  const lines = (slices, render) => slices.length === 0
    ? <span style={{ color: "#C4C9D2" }}>-</span>
    : slices.map((s, i) => (
        <div key={`${s.id}-${i}`} style={{ height: 26, lineHeight: "26px", display: "flex", alignItems: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderTop: i ? "1px solid #EFF1F4" : "none", marginTop: i ? 5 : 0, paddingTop: i ? 5 : 0 }}>{render(s)}</div>
      ));
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span className="badge badge-accepted">Paid {rs(plan.paid)}</span>
        <span className={"badge " + (plan.remaining > 0 ? "badge-pending" : "badge-accepted")}>Remaining {rs(plan.remaining)}</span>
        <span className="badge badge-muted">Total {rs(plan.total)}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Installment</th><th>Amount</th><th>Due</th><th>Payment date</th><th>Note</th><th>Paid</th></tr></thead>
          <tbody>
            {alloc.rows.map(({ inst: it, slices }) => {
              const ib = instBadge(it.status);
              return (
                <tr key={`i${it.id}`}>
                  <td style={{ verticalAlign: "top" }}>{it.label} <span className={"badge " + ib.cls} style={{ marginLeft: 4 }}>{ib.label}</span></td>
                  <td style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>{rs(it.amount)}</td>
                  <td style={{ color: "#6B7280", whiteSpace: "nowrap", verticalAlign: "top" }}>{fmtDate(it.due_date)}</td>
                  <td style={{ color: "#6B7280", whiteSpace: "nowrap", verticalAlign: "top" }}>{lines(slices, (s) => dstr(s.paid_at))}</td>
                  <td style={{ color: "#6B7280", verticalAlign: "top" }}>{lines(slices, (s) => s.note || "-")}</td>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{lines(slices, (s) => rs(s.amount))}</td>
                </tr>
              );
            })}
            {alloc.over.length > 0 && (
              <tr>
                <td style={{ color: "#B45309", fontStyle: "italic", verticalAlign: "top" }}>Extra (overpaid)</td>
                <td style={{ verticalAlign: "top" }}></td>
                <td style={{ verticalAlign: "top" }}></td>
                <td style={{ color: "#6B7280", whiteSpace: "nowrap", verticalAlign: "top" }}>{lines(alloc.over, (s) => dstr(s.paid_at))}</td>
                <td style={{ color: "#6B7280", verticalAlign: "top" }}>{lines(alloc.over, (s) => s.note || "-")}</td>
                <td style={{ fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{lines(alloc.over, (s) => rs(s.amount))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {plan.nextDue && plan.remaining > 0 && (
        <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 10 }}>Next due: {plan.nextDue.label} - {rs(plan.nextDue.amount)} by {fmtDate(plan.nextDue.due_date)}</div>
      )}
      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 10 }}>Payments are recorded by your administrator. If anything looks wrong, please contact them.</div>
    </div>
  );
}

/* The student's certificate for this course. It can be downloaded only when the
   certificate has been issued AND the course fees are fully paid, and only once
   (a second download needs the admin to re-enable it; the student requests that
   here and the admin sees the request on the course's Certificates tab). */
function CertificateView({ cert, plan, download, requestRedownload }) {
  const [msg, setMsg] = useState(null);
  if (!cert) {
    return <div className="empty-state"><div className="empty-icon"><Award /></div><p>No certificate yet. It appears here once your administrator issues it for this course.</p></div>;
  }
  const owed = plan && plan.remaining > 0 ? plan.remaining : 0;
  const fullyPaid = owed <= 0;
  const alreadyUsed = cert.downloaded && !cert.unlocked;
  const canDownload = fullyPaid && !alreadyUsed;
  const issued = new Date(Number(cert.issued_at) || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const get = async () => { setMsg(null); try { await download(cert.id, cert.cert_no); setMsg({ ok: true, text: "Certificate downloaded." }); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const ask = async () => { setMsg(null); const r = await requestRedownload(cert.id); setMsg({ ok: r.ok, text: r.msg }); };

  return (
    <div>
      <div className="media-row" style={{ marginBottom: 12 }}>
        <div className="mr-icon"><Award /></div>
        <div className="mr-body">
          <div className="mr-title">Course certificate</div>
          <div className="mr-meta">Certificate {cert.cert_no} · issued {issued}</div>
        </div>
        {canDownload && <div className="mr-actions"><Button className="btn btn-primary btn-sm" onClick={get}><Download style={{ width: 15, height: 15 }} /> Download</Button></div>}
      </div>

      {!fullyPaid && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", marginBottom: 0 }}>
          <div className="card-title" style={{ color: "var(--danger)" }}><Lock style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6 }} /> Payment required</div>
          <div className="card-subtitle" style={{ marginBottom: 0 }}>You can download your certificate once your course fees are fully paid. You still owe {rs(owed)}. Check the Payments tab for your schedule.</div>
        </div>
      )}

      {fullyPaid && alreadyUsed && (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-subtitle" style={{ marginTop: 0, marginBottom: cert.redownload_requested ? 0 : 12 }}>
            You have already downloaded this certificate once. {cert.redownload_requested
              ? "Your re-download request has been sent to your administrator."
              : "If you need it again, request a re-download and your administrator will re-enable it."}
          </div>
          {cert.redownload_requested
            ? <span className="badge badge-pending">Re-download requested</span>
            : <Button className="btn btn-outline btn-sm" onClick={ask}><RotateCcw style={{ width: 14, height: 14 }} /> Request re-download</Button>}
        </div>
      )}

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")} style={{ marginTop: 12, marginBottom: 0 }}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}
    </div>
  );
}

function MediaRow({ icon: Icon, title, meta, action, onAction, locked, lockLabel, linkPassword }) {
  return (
    <div className="media-row">
      <div className="mr-icon"><Icon /></div>
      <div className="mr-body">
        <div className="mr-title">{title}</div>
        {locked
          ? <div className="mr-meta" style={{ display: "flex", alignItems: "center", gap: 6, color: "#9CA3AF" }}><Lock style={{ width: 13, height: 13 }} /> Unlocks after {lockLabel}</div>
          : (meta && <div className="mr-meta">{meta}</div>)}
      </div>
      {locked
        ? <span className="badge badge-muted" style={{ marginLeft: "auto" }}>Locked</span>
        : (
          <div className="mr-actions">
            {linkPassword ? <CopyPasswordButton password={linkPassword} /> : null}
            {action && <button className="btn btn-outline btn-sm" onClick={onAction || undefined}>{action}</button>}
          </div>
        )}
    </div>
  );
}

/* Copies the course's recording link password to the clipboard so the student
   can paste it after opening the link, with a brief "Copied" indicator. The
   password itself is never displayed. */
function CopyPasswordButton({ password }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = password; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand("copy"); } catch { /* clipboard unavailable */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className={"btn btn-sm " + (copied ? "btn-primary" : "btn-outline")} onClick={copy}
      title="Copy the link password to paste after opening the link">
      {copied
        ? <><Check style={{ width: 14, height: 14 }} /> Copied</>
        : <><Copy style={{ width: 14, height: 14 }} /> Copy Link Password</>}
    </button>
  );
}
