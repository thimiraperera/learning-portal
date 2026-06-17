// Shared helpers for displaying payment plans and installments consistently
// across the admin and student screens. The server computes each plan's
// `status` and per-installment `status`; these map them to labels and badges.

export const rs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-US");

export function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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
  if (n <= 0) return "Available to everyone";
  if (n === 1) return "Registration fee";
  return `Installment ${n - 1}`;
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
  if (n <= 0) return "Everyone";
  if (n === 1) return "Reg fee";
  return `Inst ${n - 1}`;
}

// The buckets an admin can assign content to, derived from a course's plan
// (its number of installments). Always offers "everyone" + registration fee.
export function installmentBuckets(installments) {
  const out = [{ seq: 0, label: "Available to everyone" }, { seq: 1, label: "Registration fee" }];
  for (let i = 1; i <= (Number(installments) || 0); i++) out.push({ seq: i + 1, label: `Installment ${i}` });
  return out;
}
