import type { ProofSummary } from "@/lib/proof-board";

export function getRevenueSignal(proof: ProofSummary) {
  if (proof.preorders_or_revenue_cents > 0 || proof.payment_intent >= 5) return { label: "Strong signal", className: "bg-lime/40 text-moss" };
  if (proof.payment_intent >= 2 || proof.waitlist_signups >= 3) return { label: "Promising signal", className: "bg-gold/30 text-amber-700" };
  if (proof.payment_intent >= 1 || proof.waitlist_signups >= 1) return { label: "Weak signal", className: "bg-violet/10 text-violet" };
  return { label: "No signal", className: "bg-ink/10 text-ink/65" };
}

export function getFirstDollarStage(proof: ProofSummary) {
  if (proof.preorders_or_revenue_cents > 0) {
    return {
      stage: "Revenue evidence",
      missing: "Deliver manually before scaling.",
      nextPaymentTest: "Ask the paying user what would make the result worth repeating.",
    };
  }
  if (proof.payment_intent > 0) {
    return {
      stage: "Payment-intent evidence",
      missing: "A tiny paid delivery path.",
      nextPaymentTest: "Offer the smallest paid version to the people who showed payment intent.",
    };
  }
  if (proof.waitlist_signups > 0 || proof.interested_users > 0) {
    return {
      stage: "Interest evidence",
      missing: "Proof that users will pay, not just compliment the idea.",
      nextPaymentTest: "Ask interested users what they would pay for a small beta or preorder.",
    };
  }
  if (proof.pain_confirmed > 0 || proof.replies > 0) {
    return {
      stage: "Pain evidence",
      missing: "A concrete offer users can accept or reject.",
      nextPaymentTest: "Turn the confirmed pain into one beta offer and ask for a signup or price reaction.",
    };
  }
  return {
    stage: "No audience evidence",
    missing: "Replies from real people.",
    nextPaymentTest: "Do not test price yet. Contact 10 people and confirm the pain first.",
  };
}

export function getFirstDollarDecision(proof: ProofSummary) {
  if (proof.preorders_or_revenue_cents > 0 || proof.payment_intent > 0) return "Payment signal exists. Build the tiniest MVP around only the core pain.";
  if (proof.pain_confirmed > 0 && proof.payment_intent === 0) return "Pain exists, but value or pricing is unclear. Ask interested users if they would pay.";
  if (proof.replies > 0 && proof.pain_confirmed === 0) return "People are replying, but the problem may be weak. Narrow the audience or rewrite the pain point.";
  if (proof.people_contacted > 0 && proof.replies === 0) return "This looks like a message or audience problem. Improve the opener and contact 10 more people.";
  return "No outside signal yet. Start by asking 10 people whether this pain is real.";
}
