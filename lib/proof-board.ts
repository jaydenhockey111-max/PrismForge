import { z } from "zod";

export const validationStatuses = ["planned", "active", "completed", "paused"] as const;
export const validationChannels = ["DMs", "interviews", "survey", "landing page", "TikTok", "Reddit", "school", "email", "other"] as const;
export const validationEvidenceTypes = ["problem_interview","research_pattern","prototype_feedback","landing_page_result","waitlist_signup","service_pilot_response","pricing_response","payment_intent","content_response","marketplace_supply_response","marketplace_demand_response","physical_product_feedback","launch_check","post_launch_feedback","other"] as const;

export type ValidationStatus = (typeof validationStatuses)[number];
export type ValidationChannel = (typeof validationChannels)[number];

export type ProofMetrics = {
  people_contacted: number;
  replies: number;
  pain_confirmed: number;
  interested_users: number;
  waitlist_signups: number;
  payment_intent: number;
  preorders_or_revenue_cents: number;
};

export type ProofSummary = ProofMetrics & {
  experiment_count: number;
  confidence_score: number;
  confidence_label: "No evidence yet" | "Weak signal" | "Promising signal" | "Strong signal";
  evidence_sentence: string;
  recommended_next_action: string;
};

export const validationExperimentInputSchema = z.object({
  title: z.string().trim().min(3, "Experiment title must be at least 3 characters.").max(160),
  goal: z.string().trim().max(1000).optional().default(""),
  status: z.enum(validationStatuses).default("planned"),
  channel: z.enum(validationChannels).default("DMs"),
  hypothesis: z.string().trim().max(2000).optional().default(""),
  target_audience: z.string().trim().max(500).optional().default(""),
  task_description: z.string().trim().max(2000).optional().default(""),
  people_contacted: nonNegativeInteger(),
  replies: nonNegativeInteger(),
  pain_confirmed: nonNegativeInteger(),
  interested_users: nonNegativeInteger(),
  waitlist_signups: nonNegativeInteger(),
  payment_intent: nonNegativeInteger(),
  preorders_or_revenue_cents: nonNegativeInteger(),
  key_quotes: z.string().trim().max(4000).optional().default(""),
  learnings: z.string().trim().max(4000).optional().default(""),
  next_action: z.string().trim().max(2000).optional().default(""),
  confidence_score: z.coerce.number().int().min(0).max(100).optional().default(0),
  validation_path_id: z.string().uuid().nullable().optional().default(null),
  target_assumption_id: z.string().uuid().nullable().optional().default(null),
  evidence_type: z.enum(validationEvidenceTypes).optional().default("other"),
  decision_type: z.string().trim().max(80).nullable().optional().default(null),
  request_id: z.string().uuid().nullable().optional().default(null),
});

export type ValidationExperimentInput = z.infer<typeof validationExperimentInputSchema>;

export function computeValidationConfidence(metrics: Partial<ProofMetrics>) {
  let score = 0;
  if (Number(metrics.people_contacted ?? 0) >= 10) score += 15;
  if (Number(metrics.replies ?? 0) >= 3) score += 15;
  if (Number(metrics.pain_confirmed ?? 0) >= 3) score += 20;
  if (Number(metrics.interested_users ?? 0) >= 2) score += 20;
  if (Number(metrics.waitlist_signups ?? 0) >= 1) score += 15;
  if (Number(metrics.payment_intent ?? 0) >= 1) score += 15;
  if (Number(metrics.preorders_or_revenue_cents ?? 0) > 0) score += 25;
  return clampScore(score);
}

export function confidenceBand(score: number): ProofSummary["confidence_label"] {
  const safeScore = clampScore(score);
  if (safeScore <= 20) return "No evidence yet";
  if (safeScore <= 45) return "Weak signal";
  if (safeScore <= 70) return "Promising signal";
  return "Strong signal";
}

export function recommendNextAction(metrics: Partial<ProofMetrics>) {
  const people = Number(metrics.people_contacted ?? 0);
  const replies = Number(metrics.replies ?? 0);
  const pain = Number(metrics.pain_confirmed ?? 0);
  const interested = Number(metrics.interested_users ?? 0);
  const waitlist = Number(metrics.waitlist_signups ?? 0);
  const payment = Number(metrics.payment_intent ?? 0);
  const revenue = Number(metrics.preorders_or_revenue_cents ?? 0);

  if (people <= 0) return "Start by contacting 10 people in your target audience.";
  if (people >= 5 && replies / Math.max(1, people) < 0.25) return "Your outreach message may not be strong enough. Try a more specific pain-point DM.";
  if (revenue > 0 || payment > 0) return "Strong signal. Move toward a tiny MVP or paid beta.";
  if (pain >= 3 && payment === 0) return "Pain exists, but willingness to pay is unproven. Ask for payment or waitlist commitment next.";
  if (interested > 0 || waitlist > 0) return "Create a simple waitlist or beta invite and collect signups.";
  return "Keep validating: ask clearer pain questions and log what people actually say.";
}

export function summarizeProof(experiments: Array<Partial<ProofMetrics>>) {
  const totals = experiments.reduce<ProofMetrics>(
    (acc, experiment) => ({
      people_contacted: acc.people_contacted + Number(experiment.people_contacted ?? 0),
      replies: acc.replies + Number(experiment.replies ?? 0),
      pain_confirmed: acc.pain_confirmed + Number(experiment.pain_confirmed ?? 0),
      interested_users: acc.interested_users + Number(experiment.interested_users ?? 0),
      waitlist_signups: acc.waitlist_signups + Number(experiment.waitlist_signups ?? 0),
      payment_intent: acc.payment_intent + Number(experiment.payment_intent ?? 0),
      preorders_or_revenue_cents: acc.preorders_or_revenue_cents + Number(experiment.preorders_or_revenue_cents ?? 0),
    }),
    { people_contacted: 0, replies: 0, pain_confirmed: 0, interested_users: 0, waitlist_signups: 0, payment_intent: 0, preorders_or_revenue_cents: 0 },
  );
  const confidence_score = computeValidationConfidence(totals);
  const confidence_label = confidenceBand(confidence_score);
  return {
    ...totals,
    experiment_count: experiments.length,
    confidence_score,
    confidence_label,
    evidence_sentence: `Your project has ${confidence_label.toLowerCase()} validation evidence based on logged real-world results.`,
    recommended_next_action: recommendNextAction(totals),
  } satisfies ProofSummary;
}

export function starterExperimentTemplate(targetAudience: string, painPoint: string) {
  return {
    title: "First validation sprint",
    goal: "Find out whether this problem is painful enough to act on before building more features.",
    status: "planned" as const,
    channel: "DMs" as const,
    hypothesis: `${targetAudience || "Your target audience"} feels enough pain around "${painPoint || "this problem"}" to join a beta or waitlist.`,
    target_audience: targetAudience,
    task_description: "Contact 10 people in your target audience and ask 3–5 questions about the pain point before building more features.",
    people_contacted: 0,
    replies: 0,
    pain_confirmed: 0,
    interested_users: 0,
    waitlist_signups: 0,
    payment_intent: 0,
    preorders_or_revenue_cents: 0,
    key_quotes: "",
    learnings: "",
    next_action: "Message 10 people and log what happened.",
    confidence_score: 0,
    validation_path_id: null,
    target_assumption_id: null,
    evidence_type: "other",
    decision_type: null,
    request_id: null,
  } satisfies ValidationExperimentInput;
}

export function dollarsToCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

function nonNegativeInteger() {
  return z.coerce.number().int().min(0).default(0);
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
