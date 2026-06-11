/* Minimal TOTP (RFC 6238) using Node's crypto, so no extra dependency is
   needed for the algorithm. 6 digits, 30s step, SHA-1 (what Google
   Authenticator / Authy expect). QR images are produced with the `qrcode`
   package in server.cjs. */
const crypto = require("crypto");

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateSecret(length = 20) {
  const bytes = crypto.randomBytes(length);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) bits += B32.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return (code % 1_000_000).toString().padStart(6, "0");
}

/* Verify a 6-digit token, allowing +/- `window` time steps for clock drift. */
function verify(secret, token, window = 1) {
  const t = String(token || "").replace(/\D/g, "");
  if (t.length !== 6 || !secret) return false;
  const counter = Math.floor(Date.now() / 30000);
  for (let i = -window; i <= window; i++) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, counter + i)), Buffer.from(t))) return true;
  }
  return false;
}

function keyUri(secret, account, issuer) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}

module.exports = { generateSecret, verify, keyUri };
