// Wording for the two things that hold a course certificate back. Kept in one
// place so the student pages and the server's download refusal
// (examGateMessage in server.cjs) say the same thing.
import { rs } from "./payments.js";

export function certPaymentMessage(owed) {
  const amount = Number(owed) || 0;
  return amount > 0
    ? `You have pending payments. Settle your remaining ${rs(amount)} to download your certificate.`
    : "You have pending payments. Settle your course balance to download your certificate.";
}

// Lead sentence only, for the card that lists the outstanding exams below it.
export function certExamLead(count) {
  return Number(count) > 1
    ? "You must complete all exams to receive your certificate."
    : "You must complete the exam to receive your certificate.";
}

// The same sentence with the outstanding exams named, for the one-line form.
export function certExamMessage(pending) {
  const titles = (pending || []).map((p) => p && p.title).filter(Boolean);
  const lead = certExamLead(titles.length);
  return titles.length > 1 ? `${lead} Not completed: ${titles.join(", ")}.` : lead;
}
