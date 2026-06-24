/* Branded HTML email shell, matching the invoice-workflow look:
   a gradient header with the portal name, a white card body, and a footer.
   Logos are skipped on purpose - brand logos are stored as data URLs which
   most email clients block, so we show the portal name as text instead. */

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TONES = {
  info: { bg: "#EFF6FF", border: "#3B82F6", text: "#1E3A8A" },
  success: { bg: "#F0FDF4", border: "#16A34A", text: "#065F46" },
  danger: { bg: "#FEF2F2", border: "#DC2626", text: "#991B1B" },
  warn: { bg: "#FFFBEB", border: "#D97706", text: "#92400E" },
  purple: { bg: "#EDE9FE", border: "#7C3AED", text: "#4C1D95" },
};

function statusBox(text, tone = "info") {
  const c = TONES[tone] || TONES.info;
  return `<div style="background:${c.bg};border-left:4px solid ${c.border};border-radius:8px;padding:14px 18px;margin-bottom:24px">
    <p style="margin:0;color:${c.text};font-size:14px;font-weight:600">${text}</p></div>`;
}

function infoTable(rows) {
  const body = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 16px;color:#9CA3AF;font-size:13px;border-bottom:1px solid #F1F5FB;width:150px;font-weight:600">${esc(label)}</td>
      <td style="padding:10px 16px;font-size:13px;color:#3D3D3D;border-bottom:1px solid #F1F5FB;font-weight:500">${value}</td>
    </tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="background:#F8FAFD;border-radius:10px;border:1px solid #E2EAF4;overflow:hidden;margin-bottom:24px">${body}</table>`;
}

function button(label, url) {
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td align="center" style="padding:8px 0 28px">
      <a href="${esc(url)}" style="display:inline-block;background:linear-gradient(135deg,#1E509B,#00265E);color:white;text-decoration:none;padding:13px 32px;border-radius:999px;font-size:14px;font-weight:700">${esc(label)}</a>
    </td></tr></table>`;
}

function linkBox(url) {
  return `<div style="background:#F8FAFD;border:1px solid #E2EAF4;border-radius:8px;padding:12px 14px;margin-bottom:24px;word-break:break-all">
    <a href="${esc(url)}" style="color:#1E509B;font-size:13px;font-family:monospace">${esc(url)}</a></div>`;
}

function paragraph(html) {
  return `<p style="color:#3D3D3D;font-size:14px;line-height:1.6;margin:0 0 18px">${html}</p>`;
}

function muted(html) {
  return `<p style="color:#9CA3AF;font-size:13px;margin:0">${html}</p>`;
}

/* Wrap body content in the standard branded shell. When logoCid is given, the
   header shows that inline (cid:) image instead of the text brand name. */
function wrap({ brandName, title, subtitle, body, logoCid }) {
  const brand = esc(brandName || "Learning Portal");
  const header = logoCid
    ? `<img src="cid:${esc(logoCid)}" alt="${brand}" style="max-height:48px;max-width:220px;margin:0 auto 12px;display:block">`
    : `<div style="color:rgba(255,255,255,0.6);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">${brand}</div>`;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F4FB;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FB;padding:40px 0">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;border:1px solid #E2EAF4;box-shadow:0 4px 24px rgba(30,80,155,0.08)">
        <tr><td style="background:linear-gradient(135deg,#00265E,#1E509B);padding:32px 40px;text-align:center">
          ${header}
          <h1 style="color:white;margin:0;font-size:20px;font-weight:800;letter-spacing:-0.3px">${esc(title)}</h1>
          ${subtitle ? `<p style="color:rgba(255,255,255,0.65);margin:8px 0 0;font-size:13px">${esc(subtitle)}</p>` : ""}
        </td></tr>
        <tr><td style="padding:36px 40px">${body}</td></tr>
        <tr><td style="background:#F8FAFD;padding:18px 40px;border-top:1px solid #E2EAF4;text-align:center">
          <p style="color:#9CA3AF;font-size:12px;margin:0">${brand}<br>This is an automated message - please do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

module.exports = { wrap, statusBox, infoTable, button, linkBox, paragraph, muted, esc };
