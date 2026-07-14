// Shared helpers for displaying payment plans and installments consistently
// across the admin and student screens. The server computes each plan's
// `status` and per-installment `status`; these map them to labels and badges.

export const rs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-US");

/* Strong, shared warning text for deleting a student (used by the list and the
   manage page). sPlans = that student's payment plans (each has paid/remaining). */
export function buildDeleteWarning(name, sPlans) {
  const totalPaid = (sPlans || []).reduce((n, p) => n + (p.paid || 0), 0);
  const totalOwed = (sPlans || []).reduce((n, p) => n + (p.remaining || 0), 0);
  const lines = [
    `Deleting "${name}" permanently erases their entire record. This cannot be undone, and is NOT recommended.`,
    "",
    "It removes: the login account, all course enrolments, the payment plan and every recorded payment, all certificates, exam history, and the activity log.",
    "",
    totalOwed > 0 ? `Payments on file: ${rs(totalPaid)} paid, ${rs(totalOwed)} still owed.` : `Payments on file: ${rs(totalPaid)} paid.`,
  ];
  if (totalPaid > 0) lines.push("", `The student has already paid ${rs(totalPaid)}. Settle or refund any balance before you delete this record.`);
  lines.push("", "Recommended instead: Lock the account (set it to Inactive). The student can no longer sign in, but every record - payments, certificates, and history - is kept.");
  return lines.join("\n");
}

/* Allocate a plan's flat payment pool across its installments the same way the
   server's waterfall does, so each installment row can show the payment line(s)
   that funded it. A lump payment that spans several installments is split into
   "slices" that each keep the original payment id; anything paid beyond the last
   installment lands in `over`. Shared by the admin and student payment tables. */
export function allocatePayments(installments, payments) {
  const cents = (v) => Math.round(Number(v) * 100);
  const rows = (installments || []).map((it) => ({ inst: it, slices: [], remainC: cents(it.amount) }));
  const over = [];
  let ri = 0;
  for (const p of (payments || [])) {
    let leftC = cents(p.amount);
    while (leftC > 0 && ri < rows.length) {
      if (rows[ri].remainC <= 0) { ri++; continue; }
      const useC = Math.min(leftC, rows[ri].remainC);
      rows[ri].slices.push({ id: p.id, amount: useC / 100, note: p.note, paid_at: p.paid_at });
      rows[ri].remainC -= useC;
      leftC -= useC;
    }
    if (leftC > 0) over.push({ id: p.id, amount: leftC / 100, note: p.note, paid_at: p.paid_at });
  }
  return { rows, over };
}

// The app's configured timezone (admin Settings -> Timezone), applied here so
// every visitor sees the same calendar date for a given due/payment date
// regardless of their own device's timezone. Set once from the server config
// (see state.jsx); falls back to the browser's local timezone until loaded.
let APP_TZ = "";
export function setAppTimezone(tz) { APP_TZ = tz || ""; }

export function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: APP_TZ || undefined });
}

// Format a millisecond timestamp as a calendar date in the app's configured
// timezone (falls back to local time until that config loads), not UTC via
// toISOString, to avoid an off-by-one for timezones ahead of UTC.
export function fmtDateMs(ms) {
  const dt = new Date(Number(ms));
  return isNaN(dt) ? "" : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: APP_TZ || undefined });
}

// Plan-level badge (shown in lists). `status` comes from the server, or null
// when the student has no plan for the course.
const PLAN_BADGE = {
  paid: { cls: "badge-accepted", label: "Paid" },
  overdue: { cls: "badge-rejected", label: "Overdue" },
  partial: { cls: "badge-pending", label: "Partial" },
  pending: { cls: "badge-info", label: "Unpaid" },
  empty: { cls: "badge-muted", label: "No plan" },
};
export const planBadge = (status) => PLAN_BADGE[status] || PLAN_BADGE.empty;

// Map a plan status to the coarse filter buckets used on the Students list.
export function payFilterBucket(status) {
  if (status === "overdue") return "overdue";
  if (status === "paid") return "paid";
  if (status === "partial" || status === "pending") return "balance";
  return "none";
}

// Installment-level badge (shown in the schedule).
const INST_BADGE = {
  paid: { cls: "badge-accepted", label: "Paid" },
  partial: { cls: "badge-pending", label: "Partial" },
  missed: { cls: "badge-rejected", label: "Missed" },
  upcoming: { cls: "badge-info", label: "Upcoming" },
};
export const instBadge = (status) => INST_BADGE[status] || INST_BADGE.upcoming;

// Content can be tied to a payment stage (an installment "seq"): 0 = available
// to everyone, 1 = the registration fee, 2 = Installment 1, 3 = Installment 2...
// (seq 1 is the first schedule line, which is always the registration fee).
export function installmentLabel(seq) {
  const n = Number(seq) || 0;
  if (n < 0) return "Hidden (admin only)";
  if (n === 0) return "Available to everyone";
  if (n === 1) return "Registration fee";
  return `Installment ${n - 1}`;
}

// Turns a plain count into its ordinal word: 1 -> "1st", 2 -> "2nd", 3 -> "3rd",
// 4 -> "4th", 11-13 -> "11th"/"12th"/"13th" (teens are always "th"), 21 -> "21st"...
function ordinal(n) {
  const abs = Math.round(Math.abs(Number(n) || 0));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${abs}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[abs % 10] || "th";
  return `${abs}${suffix}`;
}

// Ordinal label for one installment, e.g. "2nd Installment" - same seq offset
// as installmentLabel above (seq 2 is Installment 1, seq 3 is Installment 2...).
// seq 1 (the reserved registration-fee slot) defers to installmentLabel so it
// still reads "Registration fee" instead of ordinalizing to "0th Installment".
export function installmentOrdinal(seq) {
  const n = Number(seq) || 0;
  if (n <= 1) return installmentLabel(n);
  return `${ordinal(n - 1)} Installment`;
}

// Header label conveying that content is available FROM a stage onward (it
// stays visible for every later payment part once that stage is reached).
export function installmentFromLabel(seq) {
  const n = Number(seq) || 0;
  if (n <= 0) return "Available to everyone";
  if (n === 1) return "Available from registration fee";
  return `Available from Installment ${n - 1}`;
}

// Compact label for the stage chips.
export function installmentShort(seq) {
  const n = Number(seq) || 0;
  if (n < 0) return "Hidden";
  if (n === 0) return "Everyone";
  if (n === 1) return "Reg fee";
  return `Inst ${n - 1}`;
}

// The buckets an admin can assign content to, derived from a course's plan
// (its number of installments). seq -1 = None (hidden from everyone but admins).
// seq 1 (registration fee) is intentionally not offered: registration fees are
// no longer taken, so it could never actually unlock. installmentLabel() still
// recognizes seq 1 for any content configured with it before that change.
export function installmentBuckets(installments) {
  const out = [
    { seq: -1, label: "None (hidden, admin only)" },
    { seq: 0, label: "Available to everyone" },
  ];
  for (let i = 1; i <= (Number(installments) || 0); i++) out.push({ seq: i + 1, label: `Installment ${i}` });
  return out;
}
