import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, Send, Award } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function ExamTake() {
  const { id } = useParams();
  const eid = Number(id);
  const navigate = useNavigate();
  const { startExam, submitExam } = useStore();
  const [state, setState] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [err, setErr] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    startExam(eid)
      .then((d) => { if (alive) { setState(d); setAnswers(new Array((d.questions || []).length).fill(null)); } })
      .catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eid]);

  const timed = state && !state.finished && state.endsAt;
  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [timed]);

  const doSubmit = useCallback(async (auto = false) => {
    if (submittedRef.current) return;
    const unanswered = answers.filter((a) => a == null).length;
    if (!auto && unanswered > 0 &&
      !window.confirm(`You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit anyway?`)) return;
    submittedRef.current = true;
    try {
      const d = await submitExam(eid, answers);
      setState((s) => ({ ...s, finished: true, score: d.score, total: d.total }));
    } catch (e) {
      submittedRef.current = false;
      setErr(e.message);
    }
  }, [answers, eid, submitExam]);

  const remaining = timed ? state.endsAt - now : null;
  useEffect(() => {
    if (timed && remaining <= 0 && !submittedRef.current) doSubmit(true);
  }, [timed, remaining, doSubmit]);

  if (err && !state) {
    return (
      <Layout title="Exam">
        <button className="back-link" onClick={() => navigate(-1)}><ArrowLeft /> Back</button>
        <div className="card"><div className="alert alert-danger" style={{ marginBottom: 0 }}><AlertTriangle /> {err}</div></div>
      </Layout>
    );
  }
  if (!state) {
    return (
      <Layout title="Exam">
        <div style={{ color: "#9CA3AF", fontWeight: 600, padding: 40, textAlign: "center" }}>Loading...</div>
      </Layout>
    );
  }

  if (state.finished) {
    const pct = state.total > 0 ? Math.round((state.score / state.total) * 100) : 0;
    return (
      <Layout title="Exam">
        <button className="back-link" onClick={() => navigate(`/courses/${state.courseId}`)}><ArrowLeft /> Back to course</button>
        <div className="page-hero">
          <div className="ph-code">{state.courseCode} - {state.courseTitle}</div>
          <h1>{state.title}</h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="empty-icon" style={{ margin: "0 auto 14px" }}><Award /></div>
          <div className="card-title" style={{ fontSize: 16 }}>Exam submitted</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "var(--primary)", margin: "8px 0 2px" }}>
            {state.score}/{state.total}
          </div>
          <div style={{ color: "#6B7280", fontWeight: 600, marginBottom: 20 }}>{pct}% correct</div>
          <button className="btn btn-primary" onClick={() => navigate(`/courses/${state.courseId}`)}>Back to course</button>
        </div>
      </Layout>
    );
  }

  const answered = answers.filter((a) => a != null).length;

  return (
    <Layout title="Exam">
      <button className="back-link" onClick={() => navigate(`/courses/${state.courseId}`)}><ArrowLeft /> Back to course</button>

      <div className="page-hero" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="ph-code">{state.courseCode} - {state.courseTitle}</div>
          <h1>{state.title}</h1>
          <p>{state.questions.length} questions{state.timeLimit > 0 ? ` · ${state.timeLimit} minute limit` : ""} · answers are saved when you submit</p>
        </div>
        {timed && (
          <span className={"exam-timer" + (remaining < 60000 ? " low" : "")}><Clock style={{ width: 16, height: 16 }} /> {fmt(remaining)}</span>
        )}
      </div>

      <div className="card">
        {err && <div className="alert alert-danger"><AlertTriangle /> {err}</div>}
        {state.questions.map((qn, i) => (
          <div key={i} className="quiz-q">
            <div className="quiz-q-text">Q{i + 1}. {qn.question}</div>
            {qn.options.map((o, j) => (
              <label key={j} className={"quiz-opt" + (answers[i] === j ? " on" : "")}>
                <input type="radio" name={`q${i}`} checked={answers[i] === j}
                  onChange={() => setAnswers((a) => a.map((v, k) => (k === i ? j : v)))} />
                {o}
              </label>
            ))}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => doSubmit(false)}><Send /> Submit exam</button>
          <span style={{ fontSize: 13, color: answered === state.questions.length ? "#16A34A" : "#9CA3AF", fontWeight: 600 }}>
            {answered === state.questions.length && <CheckCircle style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 4 }} />}
            Answered {answered} of {state.questions.length}
          </span>
        </div>
      </div>
    </Layout>
  );
}
