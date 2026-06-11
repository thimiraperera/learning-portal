import { useState } from "react";
import { ShieldCheck, ShieldAlert, CheckCircle, AlertTriangle, Save, X } from "lucide-react";
import { useStore } from "../state.jsx";

/* Self-service TOTP two-factor setup for any signed-in user. */
export default function TwoFactor() {
  const { currentUser, setup2fa, enable2fa, disable2fa } = useStore();
  const on = !!currentUser?.twoFactor;
  const [mode, setMode] = useState("idle"); // idle | setup | disable
  const [data, setData] = useState(null); // { qrDataUrl, secret, otpauthUrl }
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState(null);

  const begin = async () => {
    setMsg(null); setCode("");
    try { setData(await setup2fa()); setMode("setup"); }
    catch (e) { setMsg({ ok: false, msg: e.message }); }
  };
  const confirmEnable = async () => {
    const r = await enable2fa(code);
    setMsg(r);
    if (r.ok) { setMode("idle"); setCode(""); setData(null); }
  };
  const confirmDisable = async () => {
    const r = await disable2fa(code);
    setMsg(r);
    if (r.ok) { setMode("idle"); setCode(""); }
  };
  const cancel = () => { setMode("idle"); setCode(""); setData(null); setMsg(null); };

  return (
    <div className="card">
      <div className="card-title">
        <ShieldCheck style={{ width: 16, height: 16, verticalAlign: "-3px", marginRight: 6, color: "var(--primary)" }} />
        Two-factor authentication
      </div>
      <div className="card-subtitle">Protect your account with a code from an authenticator app (Google Authenticator, Authy, etc.).</div>

      {msg && <div className={"alert " + (msg.ok ? "alert-success" : "alert-danger")}>{msg.ok ? <CheckCircle /> : <AlertTriangle />} {msg.msg}</div>}

      {on
        ? <div className="twofa-status on"><ShieldCheck /> Two-factor authentication is <strong>on</strong>.</div>
        : <div className="twofa-status off"><ShieldAlert /> Two-factor authentication is <strong>off</strong>.</div>}

      {mode === "idle" && (
        on
          ? <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => { setMode("disable"); setMsg(null); setCode(""); }}><X /> Turn off</button>
          : <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={begin}><ShieldCheck /> Enable two-factor</button>
      )}

      {mode === "setup" && data && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 12 }}>1. Scan this QR code with your authenticator app, or enter the key manually.</p>
          <img src={data.qrDataUrl} alt="2FA QR code" style={{ width: 180, height: 180, border: "1px solid var(--border)", borderRadius: 10 }} />
          <div style={{ fontSize: 12.5, color: "#6B7280", margin: "10px 0 16px" }}>Manual key: <code style={{ fontFamily: "monospace", color: "var(--primary)", wordBreak: "break-all" }}>{data.secret}</code></div>
          <p style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 8 }}>2. Enter the 6-digit code it shows to finish.</p>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <input className="form-control" style={{ maxWidth: 180 }} inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-primary" onClick={confirmEnable}><Save /> Verify & enable</button>
            <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {mode === "disable" && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 8 }}>Enter a current 6-digit code to turn off two-factor authentication.</p>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <input className="form-control" style={{ maxWidth: 180 }} inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-danger" onClick={confirmDisable}><X /> Turn off</button>
            <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
