import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, Plus, X, CheckCircle, AlertTriangle, Settings as SettingsIcon,
  FileQuestion, FileUp, FileDown, Pencil, BarChart3, Download,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import SearchSelect from "../../components/SearchSelect.jsx";
import { useStore } from "../../state.jsx";

const SAMPLE_CSV = [
  "question,option_a,option_b,option_c,option_d,correct",
  '"What does a stock exchange primarily facilitate?","Buying and selling of shares","Printing currency","Issuing bank loans","Collecting taxes",A',
  '"Which order type executes immediately at the best available price?","Limit order","Market order","Stop order","Day order",B',
  '"True or false: diversification reduces unsystematic risk.","True","False",,,A',
].join("\r\n") + "\r\n";

export default function ExamManage() {
  const { id } = useParams();
  const eid = Number(id);
  const navigate = useNavigate();
  const store = useStore();
  const [exam, setExam] = useState(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState("questions");

  useEffect(() => {
    let alive = true;
    store.loadExam(eid)
      .then((e) => { if (alive) setExam(e); })
      .catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eid]);

  if (missing) return <Navigate to="/admin/exams" replace />;
  if (!exam) {
    return (
      <Layout title="Manage exam">
        <div style={{ color: "#9CA3AF", fontWeight: 600, padding: 40, textAlign: "center" }}>Loading...</div>
      </Layout>
    );
  }

  const tabs = [
    { k: "questions", label: "Question bank", icon: FileQuestion, n: exam.questions.length },
    { k: "settings", label: "Settings", icon: SettingsIcon },
    { k: "csv", label: "Import / Export", icon: FileUp },
    { k: "results", label: "Results", icon: BarChart3, n: exam.attempts.length },
  ];

  return (
    <Layout title="Manage exam">
      <button className="back-link" onClick={() => navigate("/admin/exams")}><ArrowLeft /> All exams</button>

      <div className="page-hero">
        <div className="ph-code">{exam.course_id ? `${exam.courseCode} - ${exam.courseTitle}` : "Not assigned to a course"}</div>
        <h1>{exam.title}</h1>
        <p>
          {exam.questions.length} question{exam.questions.length === 1 ? "" : "s"} in the bank ·
          serves {exam.question_count > 0 ? Math.min(exam.question_count, exam.questions.length) || exam.question_count : "all"} per attempt ·
          {exam.time_limit > 0 ? ` ${exam.time_limit} min limit` : " no time limit"}
        </p>
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> {t.label}{t.n != null && <span className="tab-count">{t.n}</span>}
            </button>
          ))}
        </div>
        {tab === "questions" && <QuestionsTab exam={exam} setExam={setExam} store={store} />}
        {tab === "settings" && <SettingsTab exam={exam} setExam={setExam} store={store} navigate={navigate} />}
        {tab === "csv" && <CsvTab exam={exam} setExam={setExam} store={store} />}
        {tab === "results" && <ResultsTab exam={exam} />}
      </div>
    </Layout>
  );
}

function SettingsTab({ exam, setExam, store, navigate }) {
  const { courses } = store;
  const [title, setTitle] = useState(exam.title);
  const [courseId, setCourseId] = useState(exam.course_id || "all");
  const [questionCount, setQuestionCount] = useState(exam.question_count ?? 0);
  const [timeLimit, setTimeLimit] = useState(exam.time_limit ?? 0);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    const r = await store.updateExam(exam.id, {
      title, courseId: courseId === "all" ? "" : courseId,
      questionCount, timeLimit,
    });
    setMsg(r);
    if (r.ok && r.exam) setExam(r.exam);
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${exam.title}"? This removes its questions and results. This cannot be undone.`)) return;
    await store.deleteExam(exam.id);
    navigate("/admin/exams");
  };

  return (
    <div>
      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}
      <div className="form-group"><label className="form-label">Exam title</label>
        <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">Assigned course</label>
        <SearchSelect style={{ maxWidth: 380 }} value={courseId} placeholder="Not assigned" allLabel="Not assigned"
          options={Object.entries(courses).map(([cid, c]) => ({ value: cid, label: `${c.code} - ${c.title}` }))}
          onChange={setCourseId} />
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>Students only see the exam once it is assigned to a course they are enrolled in.</div></div>
      <div className="field-row">
        <div className="form-group"><label className="form-label">Questions per attempt</label>
          <input className="form-control" type="number" min="0" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} />
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>0 serves the whole bank. Each attempt draws a random set.</div></div>
        <div className="form-group"><label className="form-label">Time limit (minutes)</label>
          <input className="form-control" type="number" min="0" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>0 means no time limit.</div></div>
      </div>
      <div style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 16 }}>Answer order is always shuffled per attempt; each student can take the exam once.</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={save}><Save /> Save settings</button>
        <button className="btn btn-danger" onClick={remove}><Trash2 /> Delete exam</button>
      </div>
    </div>
  );
}

const EMPTY_FORM = { question: "", options: ["", "", "", ""], correct: 0 };

function QuestionsTab({ exam, setExam, store }) {
  const [form, setForm] = useState(null); // null = closed; { id?, question, options, correct }
  const [msg, setMsg] = useState(null);

  const open = (qn) => {
    setMsg(null);
    setForm(qn
      ? { id: qn.id, question: qn.question, options: qn.options.slice(), correct: qn.correct }
      : { ...EMPTY_FORM, options: EMPTY_FORM.options.slice() });
  };
  const setOpt = (i, v) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }));
  const addOpt = () => setForm((f) => (f.options.length >= 6 ? f : { ...f, options: [...f.options, ""] }));
  const delOpt = (i) => setForm((f) => {
    if (f.options.length <= 2) return f;
    const options = f.options.filter((_, j) => j !== i);
    let correct = f.correct;
    if (correct === i) correct = 0;
    else if (correct > i) correct -= 1;
    return { ...f, options, correct };
  });

  const save = async () => {
    const body = { question: form.question, options: form.options, correct: form.correct };
    const r = form.id
      ? await store.updateExamQuestion(exam.id, form.id, body)
      : await store.addExamQuestion(exam.id, body);
    if (r.ok) { setExam(r.exam); setForm(null); setMsg(null); }
    else setMsg(r.msg);
  };
  const remove = async (qn) => {
    if (!window.confirm("Delete this question?")) return;
    const r = await store.deleteExamQuestion(exam.id, qn.id);
    if (r.ok) setExam(r.exam);
  };

  return (
    <div>
      {exam.questions.length === 0 && !form && (
        <div className="empty-state"><div className="empty-icon"><FileQuestion /></div>
          <p>No questions yet. Add them below or import a CSV paper from the Import / Export tab.</p></div>
      )}

      {exam.questions.map((qn, i) => (
        <div key={qn.id} className="quiz-q">
          <div className="quiz-q-text">Q{i + 1}. {qn.question}</div>
          {qn.options.map((o, j) => (
            <div key={j} style={{ fontSize: 13.5, color: j === qn.correct ? "#16A34A" : "#6B7280", padding: "3px 0 3px 14px" }}>
              {String.fromCharCode(65 + j)}. {o}{j === qn.correct && <span className="q-correct">Correct</span>}
            </div>
          ))}
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => open(qn)}><Pencil /> Edit</button>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(qn)}><Trash2 /> Delete</button>
          </div>
        </div>
      ))}

      {form ? (
        <div className="content-section" style={{ marginTop: 18 }}>
          <div className="content-section-head"><FileQuestion /> {form.id ? "Edit question" : "New question"}</div>
          {msg && <div className="alert alert-danger"><AlertTriangle /> {msg}</div>}
          <div className="form-group"><label className="form-label">Question</label>
            <textarea className="form-control" rows="2" value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} /></div>
          <label className="form-label">Options (tick the correct one)</label>
          {form.options.map((o, i) => (
            <div key={i} className="toolbar" style={{ marginBottom: 8 }}>
              <input type="radio" name="correct" checked={form.correct === i} onChange={() => setForm((f) => ({ ...f, correct: i }))}
                style={{ accentColor: "var(--primary)", width: 16, height: 16, flex: "0 0 auto" }} />
              <input className="form-control" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
              {form.options.length > 2 && (
                <button className="icon-btn-plain" title="Remove option" onClick={() => delOpt(i)}><X style={{ width: 16, height: 16 }} /></button>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {form.options.length < 6 && <button className="btn btn-ghost btn-sm" onClick={addOpt}><Plus /> Add option</button>}
            <button className="btn btn-primary btn-sm" onClick={save}><Save /> {form.id ? "Save question" : "Add question"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary" style={{ marginTop: exam.questions.length ? 16 : 0 }} onClick={() => open(null)}><Plus /> Add question</button>
      )}
    </div>
  );
}

function CsvTab({ exam, setExam, store }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState("append");
  const [result, setResult] = useState(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(f);
    e.target.value = "";
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "exam-sample.csv"; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    if (!csv.trim()) { setResult({ ok: false, msg: "Choose a CSV file or paste CSV text first." }); return; }
    if (mode === "replace" && exam.questions.length > 0 &&
      !window.confirm(`Replace all ${exam.questions.length} existing questions with the imported ones?`)) return;
    const r = await store.importExamCsv(exam.id, csv, mode);
    if (r.ok) {
      setExam(r.exam);
      setCsv(""); setFileName("");
      setResult({ ok: true, msg: `Imported ${r.imported} question${r.imported === 1 ? "" : "s"}.`, errors: r.errors });
    } else setResult({ ok: false, msg: r.msg });
  };

  const doExport = async () => {
    try { await store.exportExamCsv(exam.id); }
    catch (e) { setResult({ ok: false, msg: e.message }); }
  };

  return (
    <div>
      <div className="content-section">
        <div className="content-section-head"><FileUp /> Import a paper (CSV)</div>
        <p style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 12 }}>
          Columns: question, option_a to option_f (at least two options) and correct (the letter of the right answer).
          Leave unused option columns empty.
        </p>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <label className="btn btn-outline" style={{ cursor: "pointer" }}>
            <FileUp /> Choose CSV file
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onFile} />
          </label>
          <select className="form-control" style={{ flex: "0 0 220px" }} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="append">Add to existing questions</option>
            <option value="replace">Replace all questions</option>
          </select>
          <button className="btn btn-primary" onClick={doImport}><FileUp /> Import</button>
          <button className="btn btn-ghost" onClick={downloadSample}><Download /> Download sample CSV</button>
        </div>
        {fileName && <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 10 }}>Loaded: {fileName}</div>}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Or paste CSV text</label>
          <textarea className="form-control" rows="5" style={{ fontFamily: "monospace", fontSize: 12.5 }}
            placeholder={'question,option_a,option_b,option_c,option_d,correct\n"Your question here","First","Second","Third","Fourth",A'}
            value={csv} onChange={(e) => { setCsv(e.target.value); setFileName(""); }} />
        </div>
        {result && (
          <div className={"alert " + (result.ok ? "alert-success" : "alert-danger")} style={{ marginTop: 14, marginBottom: 0 }}>
            {result.ok ? <CheckCircle /> : <AlertTriangle />}
            <div>
              {result.msg}
              {result.errors && result.errors.length > 0 && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Skipped rows: {result.errors.slice(0, 5).join(" ")}{result.errors.length > 5 ? ` (+${result.errors.length - 5} more)` : ""}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="content-section">
        <div className="content-section-head"><FileDown /> Export this paper</div>
        <p style={{ fontSize: 12.5, color: "#9CA3AF", marginBottom: 12 }}>
          Downloads the full question bank ({exam.questions.length} question{exam.questions.length === 1 ? "" : "s"}) in the same CSV format, ready to re-import.
        </p>
        <button className="btn btn-outline" onClick={doExport} disabled={exam.questions.length === 0}><FileDown /> Export CSV</button>
      </div>
    </div>
  );
}

function ResultsTab({ exam }) {
  if (exam.attempts.length === 0) {
    return <div className="empty-state"><div className="empty-icon"><BarChart3 /></div><p>No submissions yet.</p></div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Student</th><th>Score</th><th>Submitted</th></tr>
        </thead>
        <tbody>
          {exam.attempts.map((a) => {
            const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
            return (
              <tr key={a.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{a.studentName}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{a.studentEmail}</div>
                </td>
                <td>
                  <span className={"badge " + (pct >= 50 ? "badge-accepted" : "badge-pending")}>{a.score}/{a.total} ({pct}%)</span>
                </td>
                <td style={{ color: "#6B7280" }}>
                  {new Date(Number(a.finished_at)).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
