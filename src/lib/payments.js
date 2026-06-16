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
