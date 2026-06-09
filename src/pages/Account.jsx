import { useState } from "react";
import { Save, CheckCircle, AlertTriangle, KeyRound, User } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { useStore } from "../state.jsx";

export default function Account() {
  const { currentUser, updateAccount, changePassword } = useStore();

  const [firstName, setFirstName] = useState(currentUser.firstName || "");
  const [lastName, setLastName] = useState(currentUser.lastName || "");
  const [nickname, setNickname] = useState(currentUser.nickname || "");
  const [email, setEmail] = useState(currentUser.email || "");
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [gender, setGender] = useState(currentUser.gender || "");
  const [pmsg, setPmsg] = useState(null);

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [wmsg, setWmsg] = useState(null);

  const saveProfile = async () => {
    setPmsg(await updateAccount({ firstName, lastName, nickname, email, phone, gender }));
  };

  const savePassword = async () => {
    if (next !== confirm) { setWmsg({ ok: false, msg: "New passwords do not match." }); return; }
    const r = await changePassword(cur, next);
    setWmsg(r);
    if (r.ok) { setCur(""); setNext(""); setConfirm(""); }
  };

  return (
    <Layout title="My Account">
      <div className="page-hero">
        <h1>My account</h1>
        <p>Update your profile and password. Your username cannot be changed.</p>
      </div>

      <div className="account-grid">
        {/* Profile */}
        <div className="card">
          <div className="card-title"><User style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Profile</div>
          <div className="card-subtitle">Your name, nickname and contact email.</div>

          {pmsg && (
            <div className={"alert " + (pmsg.ok ? "alert-success" : "alert-danger")}>
              {pmsg.ok ? <CheckCircle /> : <AlertTriangle />} {pmsg.msg}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-control locked-input" value={currentUser.username} readOnly disabled />
          </div>

          <div className="field-row">
            <div className="form-group">
              <label className="form-label">First name</label>
              <input className="form-control" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Last name</label>
              <input className="form-control" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nickname <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(shown in the sidebar if set)</span></label>
            <input className="form-control" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>

          <div className="field-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 ..." />
            </div>
          </div>

          <div className="form-group" style={{ maxWidth: 300 }}>
            <label className="form-label">Gender</label>
            <select className="form-control" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Not specified</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <button className="btn btn-primary" onClick={saveProfile}><Save /> Save profile</button>
        </div>

        {/* Password */}
        <div className="card">
          <div className="card-title"><KeyRound style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />Password</div>
          <div className="card-subtitle">Use at least 6 characters.</div>

          {wmsg && (
            <div className={"alert " + (wmsg.ok ? "alert-success" : "alert-danger")}>
              {wmsg.ok ? <CheckCircle /> : <AlertTriangle />} {wmsg.msg}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Current password</label>
            <input className="form-control" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">New password</label>
            <input className="form-control" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm new password</label>
            <input className="form-control" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>

          <button className="btn btn-primary" onClick={savePassword}><KeyRound /> Change password</button>
        </div>
      </div>
    </Layout>
  );
}
