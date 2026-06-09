import { useState } from "react";
import { Plus, X, PlayCircle, Link2, FileDown } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { useStore } from "../../state.jsx";

const BUCKETS = {
  recordings: { label: "Recording", icon: PlayCircle },
  links:      { label: "Link", icon: Link2 },
  materials:  { label: "Material", icon: FileDown },
};

export default function Courses() {
  const { courses, addCourse, addItem, removeItem } = useStore();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");

  const create = () => { if (addCourse(title, code)) { setTitle(""); setCode(""); } };

  return (
    <Layout title="Courses">
      <div className="page-hero">
        <h1>Courses</h1>
        <p>Create courses and attach materials. Recordings are stored as URLs; downloads go to a private bucket.</p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Add a course</div>
        <div className="card-subtitle">A code identifies the course across the system.</div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input className="form-control" placeholder="Course title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="form-control" style={{ flex: "0 0 180px" }} placeholder="Code (e.g. EQ-101)" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-primary" onClick={create}><Plus /> Add course</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {Object.entries(courses).map(([id, c]) => (
          <CourseBlock key={id} id={id} c={c} addItem={addItem} removeItem={removeItem} />
        ))}
      </div>
    </Layout>
  );
}

function CourseBlock({ id, c, addItem, removeItem }) {
  const [bucket, setBucket] = useState("recordings");
  const [value, setValue] = useState("");
  const total = c.recordings.length + c.links.length + c.materials.length;

  const attach = () => { if (value.trim()) { addItem(id, bucket, value); setValue(""); } };

  const rows = [
    ...c.recordings.map((m, i) => ({ bucket: "recordings", i, t: m.t })),
    ...c.links.map((m, i) => ({ bucket: "links", i, t: m.t })),
    ...c.materials.map((m, i) => ({ bucket: "materials", i, t: m.t })),
  ];

  return (
    <div className="card">
      <div className="section-header" style={{ marginBottom: rows.length ? 16 : 4 }}>
        <div>
          <div className="card-title">
            <span className="cc-code" style={{ marginRight: 8 }}>{c.code}</span>{c.title}
          </div>
          <div className="card-subtitle" style={{ marginBottom: 0 }}>{total} item{total === 1 ? "" : "s"}</div>
        </div>
      </div>

      {rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {rows.map((r) => {
            const B = BUCKETS[r.bucket];
            return (
              <div key={r.bucket + r.i} className="media-row" style={{ marginBottom: 0, padding: "10px 14px" }}>
                <div className="mr-icon" style={{ width: 34, height: 34 }}><B.icon /></div>
                <div className="mr-body"><div className="mr-title" style={{ marginBottom: 0 }}>{r.t}</div></div>
                <span className="badge badge-info">{B.label}</span>
                <button className="icon-btn-plain" onClick={() => removeItem(id, r.bucket, r.i)}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <select className="form-control" value={bucket} onChange={(e) => setBucket(e.target.value)}>
          <option value="recordings">Recording</option>
          <option value="links">Link</option>
          <option value="materials">Material</option>
        </select>
        <input className="form-control" placeholder="Title / URL" value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") attach(); }} />
        <button className="btn btn-ghost" onClick={attach}><Plus /> Attach</button>
      </div>
    </div>
  );
}
