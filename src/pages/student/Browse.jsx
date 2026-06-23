import { useState } from "react";
import { BookOpen, Send, Clock, Search, CheckCircle, AlertTriangle } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import Button from "../../components/Button.jsx";
import { useStore } from "../../state.jsx";

/* Courses the student is NOT enrolled in. They can request enrolment;
   an admin approves it. */
export default function Browse() {
  const { locked, requests, requestCourse } = useStore();
  const [qy, setQy] = useState("");
  const [msg, setMsg] = useState(null);
  const requested = new Set(requests);

  const ql = qy.trim().toLowerCase();
  const list = locked.filter((c) => !ql || c.title.toLowerCase().includes(ql) || (c.code || "").toLowerCase().includes(ql));

  const ask = async (c) => {
    setMsg(null);
    const r = await requestCourse(c.id);
    if (r.ok) setMsg({ ok: true, text: `Request sent for ${c.title}. An administrator will review it.` });
    else setMsg({ ok: false, text: r.msg });
  };

  return (
    <Layout title="Browse courses">
      <div className="page-hero">
        <h1>Browse courses</h1>
        <p>Courses you are not enrolled in yet. Request access and an administrator will review it.</p>
      </div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.text}</div>}

      <div className="card">
        <div style={{ position: "relative", marginBottom: 18 }}>
          <Search style={{ position: "absolute", left: 12, top: 11, width: 16, height: 16, color: "#9CA3AF" }} />
          <input className="form-control" style={{ paddingLeft: 36 }} placeholder="Search courses by name or code"
            value={qy} onChange={(e) => setQy(e.target.value)} />
        </div>

        {list.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><BookOpen /></div><p>{locked.length === 0 ? "You're enrolled in every course." : "No courses match."}</p></div>
        ) : (
          <div className="course-grid">
            {list.map((c) => (
              <div key={c.id} className="course-card" style={{ cursor: "default" }}>
                <div className="cc-top">
                  <span className="cc-code">{c.code}</span>
                  <span className="cc-sessions">{c.sessions} sessions</span>
                </div>
                <h3>{c.title}</h3>
                <div className="cc-blurb">{c.blurb}</div>
                <div className="cc-foot" style={{ justifyContent: "flex-end" }}>
                  {requested.has(c.id)
                    ? <span className="badge badge-pending"><Clock style={{ width: 13, height: 13, verticalAlign: "-2px", marginRight: 4 }} />Requested</span>
                    : <Button className="btn btn-primary" onClick={() => ask(c)}><Send /> Request access</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
