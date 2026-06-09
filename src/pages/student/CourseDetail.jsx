import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowLeft, PlayCircle, Link2, FileDown, Calendar, Clock,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, courses } = useStore();
  const [tab, setTab] = useState("rec");

  // Guard: never render a course the student isn't enrolled in.
  if (!currentUser.enrolled.includes(id)) return <Navigate to="/" replace />;
  const c = courses[id];

  const tabs = [
    { k: "rec", label: "Recordings", icon: PlayCircle, n: c.recordings.length },
    { k: "lnk", label: "Course links", icon: Link2, n: c.links.length },
    { k: "mat", label: "Materials", icon: FileDown, n: c.materials.length },
  ];

  return (
    <Layout title="Course">
      <button className="back-link" onClick={() => navigate("/")}>
        <ArrowLeft /> All courses
      </button>

      <div className="page-hero">
        <div className="ph-code">{c.code}</div>
        <h1>{c.title}</h1>
        <p>{c.blurb}</p>
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab-btn" + (tab === t.k ? " on" : "")} onClick={() => setTab(t.k)}>
              <t.icon /> {t.label} <span className="tab-count">{t.n}</span>
            </button>
          ))}
        </div>

        {tab === "rec" && c.recordings.map((r, i) => (
          <MediaRow key={i} icon={PlayCircle} title={r.t} action="Watch"
            meta={<><Calendar /> {r.d} <span className="dot" /> <Clock /> {r.len}</>} />
        ))}
        {tab === "lnk" && c.links.map((r, i) => (
          <MediaRow key={i} icon={Link2} title={r.t} action="Open"
            meta={<span style={{ fontFamily: "monospace", fontSize: 12 }}>{r.u}</span>} />
        ))}
        {tab === "mat" && c.materials.map((r, i) => (
          <MediaRow key={i} icon={FileDown} title={r.t} action="Download"
            meta={<><span className="ext-tag">{r.ext}</span> {r.size}</>} />
        ))}
      </div>
    </Layout>
  );
}

function MediaRow({ icon: Icon, title, meta, action }) {
  return (
    <div className="media-row">
      <div className="mr-icon"><Icon /></div>
      <div className="mr-body">
        <div className="mr-title">{title}</div>
        <div className="mr-meta">{meta}</div>
      </div>
      <button className="btn btn-outline btn-sm">{action}</button>
    </div>
  );
}
