export type VerificationLevel = "system_verified" | "evidence_supported" | "manual_detailed" | "self_reported";
export type ProgressCategory = "project_structure" | "quest" | "next_action" | "evidence" | "experiment" | "decision" | "milestone" | "launch" | "revenue" | "learning" | "legacy";

export const FOUNDER_XP_RULES = {
  project_context_completed: rule(25, "project_structure", "Completed meaningful project context"),
  next_best_action_completed: rule(20, "next_action", "Completed a Next Best Action"),
  proof_experiment_defined: rule(15, "experiment", "Defined a testable experiment"),
  proof_evidence_recorded: rule(20, "evidence", "Recorded a distinct evidence-supported learning"),
  proof_experiment_completed: rule(35, "experiment", "Completed an experiment and recorded the result"),
  evidence_based_decision: rule(25, "decision", "Made a decision using recorded evidence"),
  first_customer_contact: rule(20, "milestone", "Recorded the first customer contact"),
  five_customer_contacts: rule(35, "milestone", "Reached five customer contacts"),
  ten_customer_contacts: rule(25, "milestone", "Reached ten customer contacts"),
  first_customer_reply: rule(20, "milestone", "Recorded the first customer reply"),
  three_customer_replies: rule(40, "milestone", "Reached three customer replies"),
  first_pain_confirmation: rule(25, "milestone", "Recorded the first pain confirmation"),
  three_pain_confirmations: rule(50, "milestone", "Reached three pain confirmations"),
  first_interest_signal: rule(35, "milestone", "Recorded the first interested user"),
  first_waitlist_signal: rule(45, "milestone", "Recorded the first waitlist signup"),
  first_payment_intent: rule(65, "revenue", "Recorded the first detailed payment-intent signal"),
  first_revenue: rule(90, "revenue", "Recorded the first detailed revenue signal"),
  daily_quest_completed: rule(15, "quest", "Completed a daily execution quest"),
  weekly_quest_completed: rule(35, "quest", "Completed a weekly execution outcome"),
  project_closed_reflection: rule(35, "learning", "Closed a project with a documented reflection"),
} as const;

function rule(baseXp: number, category: ProgressCategory, label: string) {
  return { baseXp, category, label } as const;
}

export type FounderXpEventType = keyof typeof FOUNDER_XP_RULES;

export const VERIFICATION_MULTIPLIERS: Record<VerificationLevel, number> = {
  system_verified: 1,
  evidence_supported: 1,
  manual_detailed: 0.5,
  self_reported: 0,
};

export function calculateAwardedXp(eventType: FounderXpEventType, verificationLevel: VerificationLevel) {
  return Math.round(FOUNDER_XP_RULES[eventType].baseXp * VERIFICATION_MULTIPLIERS[verificationLevel]);
}

// Old call sites remain typed, but activity-only actions intentionally earn zero.
export const ACTION_XP = {
  profile_completed: 0, email_verified: 0, opportunity_viewed: 0, opportunity_saved: 0,
  opportunity_applied: 0, opportunity_won: 0, friend_invited: 0, daily_quest_completed: 0,
  streak_maintained: 0, profile_updated: 0, challenge_joined: 0, challenge_completed: 0,
  collection_completed: 0, reward_bonus: 0, founder_report_generated: 0,
  founder_project_launched: 0, execution_output_saved: 0,
} as const;

export type GamificationAction = keyof typeof ACTION_XP;

export const XP_GUIDE = [
  FOUNDER_XP_RULES.next_best_action_completed,
  FOUNDER_XP_RULES.proof_experiment_defined,
  FOUNDER_XP_RULES.proof_evidence_recorded,
  FOUNDER_XP_RULES.proof_experiment_completed,
  FOUNDER_XP_RULES.evidence_based_decision,
  FOUNDER_XP_RULES.five_customer_contacts,
  FOUNDER_XP_RULES.first_waitlist_signal,
  FOUNDER_XP_RULES.first_payment_intent,
];

export const ZERO_XP_EVENTS = [
  "Opening pages or tabs", "Refreshing or signing in", "Running or regenerating AI output",
  "Starting, replacing, or skipping a quest", "Repeatedly editing the same field",
  "Changing project stages back and forth", "Duplicate or unsupported evidence",
] as const;
