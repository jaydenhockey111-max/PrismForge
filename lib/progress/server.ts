import "server-only";

import { createHash } from "node:crypto";
import type { Json, ProjectValidationExperiment } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FounderXpEventType, VerificationLevel } from "@/lib/progress/xpPolicy";

export type ProgressAwardResult = {
  inserted: boolean;
  awardedXp: number;
  levelBefore: number;
  levelAfter: number;
  totalXp: number;
  rejectionReason?: string | null;
};

type AwardInput = {
  userId: string;
  projectId?: string | null;
  eventType: FounderXpEventType;
  verificationLevel: VerificationLevel;
  sourceType: "project" | "quest" | "proof_experiment" | "proof_fingerprint" | "milestone" | "reflection";
  sourceId: string;
  idempotencyKey: string;
  reason: string;
  metadata?: Record<string, Json | undefined>;
};

export async function awardFounderProgress(input: AwardInput): Promise<ProgressAwardResult> {
  const admin = createAdminClient() as any;
  const { data, error } = await admin.rpc("record_founder_xp_event", {
    p_user_id: input.userId,
    p_project_id: input.projectId ?? null,
    p_event_type: input.eventType,
    p_verification_level: input.verificationLevel,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_idempotency_key: input.idempotencyKey,
    p_reason: input.reason,
    p_metadata: cleanMetadata(input.metadata ?? {}),
  });
  if (error) {
    if (/record_founder_xp_event|schema cache|does not exist/i.test(String(error.message ?? ""))) {
      throw new Error("Evidence-based progression is not ready yet. Run the latest Supabase migration.");
    }
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    inserted: Boolean(row?.inserted),
    awardedXp: Number(row?.awarded_xp ?? 0),
    levelBefore: Number(row?.level_before ?? 1),
    levelAfter: Number(row?.level_after ?? 1),
    totalXp: Number(row?.total_xp ?? 0),
    rejectionReason: typeof row?.rejection_reason === "string" ? row.rejection_reason : null,
  };
}

export async function reconcileProjectProgress(userId: string, projectId: string) {
  const admin = createAdminClient();
  const [{ data: project }, { data: experiments }] = await Promise.all([
    admin.from("opportunity_projects").select("id,user_id,status,report_json").eq("id", projectId).eq("user_id", userId).maybeSingle(),
    admin.from("project_validation_experiments").select("*").eq("project_id", projectId).eq("user_id", userId).order("created_at", { ascending: true }),
  ]);
  if (!project) throw new Error("Project not found.");

  const awards: ProgressAwardResult[] = [];
  if (hasMeaningfulProjectContext(project.report_json)) {
    awards.push(await awardFounderProgress({
      userId, projectId, eventType: "project_context_completed", verificationLevel: "system_verified",
      sourceType: "project", sourceId: projectId, idempotencyKey: `project:${projectId}:context-completed`,
      reason: "Completed the project audience, problem, and smallest useful version.",
    }));
  }

  for (const experiment of experiments ?? []) {
    awards.push(...await reconcileExperiment(userId, projectId, experiment));
  }
  awards.push(...await reconcileProofMilestones(userId, projectId, experiments ?? []));
  await reverseUnmetMilestones(userId, projectId, experiments ?? []);
  return awards;
}

export async function reverseExperimentProgress(userId: string, projectId: string, experiment: ProjectValidationExperiment) {
  const admin = createAdminClient();
  const fingerprint = evidenceFingerprint(experiment);
  const { data: events, error } = await admin
    .from("xp_events")
    .select("id,source_type,source_id,event_status")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("event_status", "awarded")
    .or(`and(source_type.eq.proof_experiment,source_id.eq.${experiment.id}),and(source_type.eq.proof_fingerprint,source_id.eq.${fingerprint})`);
  if (error) throw error;
  for (const event of events ?? []) {
    await reverseFounderProgressEvent(userId, event.id, "Underlying Proof Board evidence was deleted.", `reversal:${event.id}:source-deleted`);
  }
}

export async function reverseFounderProgressEvent(userId: string, eventId: string, reason: string, idempotencyKey: string) {
  const admin = createAdminClient() as any;
  const { data, error } = await admin.rpc("reverse_founder_xp_event", {
    p_user_id: userId, p_event_id: eventId, p_reason: reason, p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function reconcileExperiment(userId: string, projectId: string, experiment: ProjectValidationExperiment) {
  const awards: ProgressAwardResult[] = [];
  const definition = [experiment.goal, experiment.hypothesis, experiment.task_description].filter(hasDetail).join(" ");
  if (definition.length >= 20) {
    awards.push(await awardFounderProgress({
      userId, projectId, eventType: "proof_experiment_defined", verificationLevel: "system_verified",
      sourceType: "proof_experiment", sourceId: experiment.id, idempotencyKey: `experiment:${experiment.id}:defined`,
      reason: "Defined a testable Proof Board experiment.",
    }));
  }

  const evidenceCount = experiment.people_contacted + experiment.replies + experiment.pain_confirmed + experiment.interested_users + experiment.waitlist_signups + experiment.payment_intent;
  const evidenceDetail = [experiment.key_quotes, experiment.learnings].filter(hasDetail).join(" ");
  if (evidenceCount > 0 && evidenceDetail.length >= 12) {
    const fingerprint = evidenceFingerprint(experiment);
    awards.push(await awardFounderProgress({
      userId, projectId, eventType: "proof_evidence_recorded", verificationLevel: "evidence_supported",
      sourceType: "proof_fingerprint", sourceId: fingerprint, idempotencyKey: `evidence:${projectId}:${fingerprint}`,
      reason: "Recorded a distinct result or learning with supporting Proof Board detail.",
      metadata: { experiment_id: experiment.id, evidence_kind: strongestEvidenceKind(experiment) },
    }));
  }

  if (experiment.status === "completed" && hasDetail(experiment.learnings)) {
    awards.push(await awardFounderProgress({
      userId, projectId, eventType: "proof_experiment_completed", verificationLevel: "evidence_supported",
      sourceType: "proof_experiment", sourceId: experiment.id, idempotencyKey: `experiment:${experiment.id}:completed-with-learning`,
      reason: "Completed an experiment and recorded what was learned.",
    }));
  }
  if (hasDetail(experiment.learnings) && hasDetail(experiment.next_action)) {
    awards.push(await awardFounderProgress({
      userId, projectId, eventType: "evidence_based_decision", verificationLevel: "evidence_supported",
      sourceType: "proof_experiment", sourceId: experiment.id, idempotencyKey: `decision:${experiment.id}:learning-to-next-action`,
      reason: "Connected recorded learning to a concrete next decision.",
    }));
  }
  return awards;
}

async function reconcileProofMilestones(userId: string, projectId: string, experiments: ProjectValidationExperiment[]) {
  const totals = proofTotals(experiments);
  const definitions: Array<[boolean, FounderXpEventType, VerificationLevel, string]> = [
    [totals.contacts >= 1, "first_customer_contact", "evidence_supported", "Recorded the first customer contact."],
    [totals.contacts >= 5, "five_customer_contacts", "evidence_supported", "Reached five recorded customer contacts."],
    [totals.contacts >= 10, "ten_customer_contacts", "evidence_supported", "Reached ten recorded customer contacts; later repetition earns less."],
    [totals.replies >= 1, "first_customer_reply", "evidence_supported", "Recorded the first customer reply."],
    [totals.replies >= 3, "three_customer_replies", "evidence_supported", "Reached three recorded customer replies."],
    [totals.pain >= 1, "first_pain_confirmation", "evidence_supported", "Recorded the first pain confirmation."],
    [totals.pain >= 3, "three_pain_confirmations", "evidence_supported", "Reached three recorded pain confirmations."],
    [totals.interest >= 1, "first_interest_signal", "evidence_supported", "Recorded the first interested user."],
    [totals.waitlist >= 1, "first_waitlist_signal", "evidence_supported", "Recorded the first waitlist signal."],
    [totals.paymentIntent >= 1, "first_payment_intent", "manual_detailed", "Recorded the first detailed, manually reported payment-intent signal."],
    [totals.revenue > 0, "first_revenue", "manual_detailed", "Recorded the first detailed, manually reported revenue signal."],
  ];
  const results: ProgressAwardResult[] = [];
  for (const [met, eventType, verificationLevel, reason] of definitions) {
    if (!met) continue;
    results.push(await awardFounderProgress({
      userId, projectId, eventType, verificationLevel, sourceType: "milestone", sourceId: `${projectId}:${eventType}`,
      idempotencyKey: `milestone:${projectId}:${eventType}`, reason,
    }));
  }
  return results;
}

async function reverseUnmetMilestones(userId: string, projectId: string, experiments: ProjectValidationExperiment[]) {
  const totals = proofTotals(experiments);
  const stillMet: Record<string, boolean> = {
    first_customer_contact: totals.contacts >= 1, five_customer_contacts: totals.contacts >= 5, ten_customer_contacts: totals.contacts >= 10,
    first_customer_reply: totals.replies >= 1, three_customer_replies: totals.replies >= 3,
    first_pain_confirmation: totals.pain >= 1, three_pain_confirmations: totals.pain >= 3,
    first_interest_signal: totals.interest >= 1, first_waitlist_signal: totals.waitlist >= 1,
    first_payment_intent: totals.paymentIntent >= 1, first_revenue: totals.revenue > 0,
  };
  const admin = createAdminClient();
  const { data: events } = await admin.from("xp_events").select("id,action").eq("user_id", userId).eq("project_id", projectId).eq("source_type", "milestone").eq("event_status", "awarded");
  for (const event of events ?? []) {
    if (stillMet[event.action] !== false) continue;
    await reverseFounderProgressEvent(userId, event.id, "The supporting project milestone is no longer present.", `reversal:${event.id}:milestone-unmet`);
  }
}

function proofTotals(experiments: ProjectValidationExperiment[]) {
  return experiments.reduce((sum, item) => ({
    contacts: sum.contacts + item.people_contacted, replies: sum.replies + item.replies,
    pain: sum.pain + item.pain_confirmed, interest: sum.interest + item.interested_users,
    waitlist: sum.waitlist + item.waitlist_signups, paymentIntent: sum.paymentIntent + item.payment_intent,
    revenue: sum.revenue + item.preorders_or_revenue_cents,
  }), { contacts: 0, replies: 0, pain: 0, interest: 0, waitlist: 0, paymentIntent: 0, revenue: 0 });
}

function evidenceFingerprint(experiment: ProjectValidationExperiment) {
  const canonical = [experiment.title, experiment.hypothesis, experiment.key_quotes, experiment.learnings, experiment.people_contacted, experiment.replies, experiment.pain_confirmed, experiment.interested_users, experiment.waitlist_signups, experiment.payment_intent, experiment.preorders_or_revenue_cents]
    .map((value) => String(value ?? "").toLowerCase().replace(/https?:\/\/[^\s]+/g, "[url]").replace(/\s+/g, " ").trim()).join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

function strongestEvidenceKind(experiment: ProjectValidationExperiment) {
  if (experiment.preorders_or_revenue_cents > 0) return "revenue";
  if (experiment.payment_intent > 0) return "payment_intent";
  if (experiment.waitlist_signups > 0) return "waitlist";
  if (experiment.pain_confirmed > 0) return "pain_confirmation";
  if (experiment.replies > 0) return "reply";
  return "customer_contact";
}

function hasMeaningfulProjectContext(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const report = value as Record<string, any>;
  return hasDetail(report.summary?.targetCustomer) && hasDetail(report.summary?.painPoint) &&
    (Array.isArray(report.mvpPlan?.mustHaveFeatures) || Array.isArray(report.mvpPlan?.featureList));
}

function hasDetail(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 12;
}

function cleanMetadata(metadata: Record<string, Json | undefined>) {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}
