"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import type { ProjectValidationExperiment } from "@/lib/database.types";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import { recommendationFingerprint } from "@/lib/founder-os/coreLoop";
import { routeValidationPath } from "@/lib/founder-os/validationReadiness";
import { computeValidationConfidence, summarizeProof, validationExperimentInputSchema, type ProofSummary, type ValidationExperimentInput } from "@/lib/proof-board";
import { reconcileProjectProgress, reverseExperimentProgress } from "@/lib/progress/server";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();

export async function listValidationExperiments(projectId: string) {
  const profile = await requireProfile();
  const parsedProjectId = uuidSchema.safeParse(projectId);
  if (!parsedProjectId.success) throw new Error("Invalid project id.");

  const supabase = await createClient();
  await requireOwnedProject(supabase, profile.id, parsedProjectId.data);

  const { data, error } = await supabase
    .from("project_validation_experiments")
    .select("*")
    .eq("project_id", parsedProjectId.data)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) throwProofBoardError(error.message);
  return data ?? [];
}

export async function createValidationExperiment(projectId: string, input: ValidationExperimentInput) {
  const profile = await requireProfile();
  const parsedProjectId = uuidSchema.safeParse(projectId);
  if (!parsedProjectId.success) throw new Error("Invalid project id.");

  const parsed = validationExperimentInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid validation experiment.");

  const supabase = await createClient();
  const project = await requireOwnedProject(supabase, profile.id, parsedProjectId.data);
  await requireOwnedValidationLinks(supabase, profile.id, parsedProjectId.data, parsed.data.validation_path_id, parsed.data.target_assumption_id);
  const { data: existingProof, count: existingProofCount } = await supabase
    .from("project_validation_experiments")
    .select("*", { count: "exact" })
    .eq("project_id", parsedProjectId.data)
    .eq("user_id", profile.id);
  const payload = normalizePayload(parsed.data);

  const { data, error } = await supabase
    .from("project_validation_experiments")
    .insert({
      ...payload,
      project_id: parsedProjectId.data,
      user_id: profile.id,
      confidence_score: computeValidationConfidence(payload),
    })
    .select("*")
    .single();

  if (error) throwProofBoardError(error.message);
  await logBetaEvent({
    userId: profile.id,
    projectId: parsedProjectId.data,
    eventName: "proof_experiment_created",
    source: "proof_board",
    metadata: { status: data.status, channel: data.channel, confidence_score: data.confidence_score },
  });
  if ((existingProofCount ?? 0) === 0) {
    await logBetaEvent({
      userId: profile.id,
      projectId: parsedProjectId.data,
      eventName: "first_evidence_saved",
      source: "proof_board",
      metadata: { status: data.status, channel: data.channel, confidence_score: data.confidence_score },
    });
  }
  await applyEvidenceGuidanceUpdate({
    userId: profile.id,
    project,
    before: (existingProof ?? []) as ProjectValidationExperiment[],
    after: [data as ProjectValidationExperiment, ...((existingProof ?? []) as ProjectValidationExperiment[])],
    assumptionId: payload.target_assumption_id,
    requestId: payload.request_id,
    currentExperiment: data as ProjectValidationExperiment,
  });
  await reconcileProgressSafely(profile.id, parsedProjectId.data, "proof_create");
  revalidatePath(`/projects/${parsedProjectId.data}`);
  revalidatePath(`/projects/${parsedProjectId.data}/timeline`);
  revalidatePath("/timeline");
  return data;
}

export async function updateValidationExperiment(experimentId: string, input: ValidationExperimentInput) {
  const profile = await requireProfile();
  const parsedExperimentId = uuidSchema.safeParse(experimentId);
  if (!parsedExperimentId.success) throw new Error("Invalid experiment id.");

  const parsed = validationExperimentInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid validation experiment.");

  const supabase = await createClient();
  const experiment = await requireOwnedExperiment(supabase, profile.id, parsedExperimentId.data);
  const project = await requireOwnedProject(supabase, profile.id, experiment.project_id);
  await requireOwnedValidationLinks(supabase, profile.id, experiment.project_id, parsed.data.validation_path_id, parsed.data.target_assumption_id);
  const { data: existingProof } = await supabase.from("project_validation_experiments").select("*").eq("project_id", experiment.project_id).eq("user_id", profile.id);
  const payload = normalizePayload(parsed.data);

  const { data, error } = await supabase
    .from("project_validation_experiments")
    .update({
      ...payload,
      confidence_score: computeValidationConfidence(payload),
    })
    .eq("id", parsedExperimentId.data)
    .eq("user_id", profile.id)
    .select("*")
    .single();

  if (error) throwProofBoardError(error.message);
  await logBetaEvent({
    userId: profile.id,
    projectId: experiment.project_id,
    eventName: "proof_experiment_updated",
    source: "proof_board",
    metadata: { status: data.status, channel: data.channel, confidence_score: data.confidence_score },
  });
  const before = (existingProof ?? []) as ProjectValidationExperiment[];
  await applyEvidenceGuidanceUpdate({
    userId: profile.id,
    project,
    before,
    after: before.map((item) => item.id === data.id ? data as ProjectValidationExperiment : item),
    assumptionId: payload.target_assumption_id,
    requestId: payload.request_id,
    currentExperiment: data as ProjectValidationExperiment,
  });
  await reconcileProgressSafely(profile.id, experiment.project_id, "proof_update");
  revalidatePath(`/projects/${experiment.project_id}`);
  revalidatePath(`/projects/${experiment.project_id}/timeline`);
  revalidatePath("/timeline");
  return data;
}

export async function deleteValidationExperiment(experimentId: string) {
  const profile = await requireProfile();
  const parsedExperimentId = uuidSchema.safeParse(experimentId);
  if (!parsedExperimentId.success) throw new Error("Invalid experiment id.");

  const supabase = await createClient();
  const experiment = await requireOwnedExperiment(supabase, profile.id, parsedExperimentId.data);

  const { error } = await supabase
    .from("project_validation_experiments")
    .delete()
    .eq("id", parsedExperimentId.data)
    .eq("user_id", profile.id);

  if (error) throwProofBoardError(error.message);
  try {
    await reverseExperimentProgress(profile.id, experiment.project_id, experiment);
    await reconcileProjectProgress(profile.id, experiment.project_id);
  } catch {
    await logBetaEvent({ userId: profile.id, projectId: experiment.project_id, eventName: "progression_reconciliation_failed", source: "proof_board", metadata: { operation: "delete" } });
  }
  await logBetaEvent({
    userId: profile.id,
    projectId: experiment.project_id,
    eventName: "proof_experiment_deleted",
    source: "proof_board",
    metadata: { experiment_id: parsedExperimentId.data },
  });
  revalidatePath(`/projects/${experiment.project_id}`);
  revalidatePath(`/projects/${experiment.project_id}/timeline`);
  revalidatePath("/timeline");
  return { deleted: true };
}

export async function computeProofSummary(projectId: string): Promise<ProofSummary> {
  const experiments = await listValidationExperiments(projectId);
  return summarizeProof(experiments);
}

async function requireOwnedProject(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, projectId: string) {
  const { data, error } = await supabase
    .from("opportunity_projects")
    .select("id,status,report_json,lifecycle_status,deleted_at,is_synthetic")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Project not found.");
  if (data.deleted_at || data.lifecycle_status !== "active") throw new Error("Resume or restore this project before changing Proof Board evidence.");
  return data;
}

async function requireOwnedExperiment(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, experimentId: string): Promise<ProjectValidationExperiment> {
  const { data, error } = await supabase
    .from("project_validation_experiments")
    .select("*")
    .eq("id", experimentId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throwProofBoardError(error?.message ?? "Validation experiment not found.");
  return data;
}

function throwProofBoardError(message: string): never {
  if (/project_validation_experiments|relation .* does not exist|schema cache/i.test(message)) {
    throw new Error("Proof Board is not ready yet. Run the latest Supabase migration, then refresh this project.");
  }
  throw new Error(message);
}

function normalizePayload(input: ValidationExperimentInput) {
  return {
    title: input.title,
    goal: input.goal || null,
    status: input.status,
    channel: input.channel,
    hypothesis: input.hypothesis || null,
    target_audience: input.target_audience || null,
    task_description: input.task_description || null,
    people_contacted: input.people_contacted,
    replies: input.replies,
    pain_confirmed: input.pain_confirmed,
    interested_users: input.interested_users,
    waitlist_signups: input.waitlist_signups,
    payment_intent: input.payment_intent,
    preorders_or_revenue_cents: input.preorders_or_revenue_cents,
    key_quotes: input.key_quotes || null,
    learnings: input.learnings || null,
    next_action: input.next_action || null,
    validation_path_id: input.validation_path_id,
    target_assumption_id: input.target_assumption_id,
    evidence_type: input.evidence_type,
    decision_type: input.decision_type,
    request_id: input.request_id,
  };
}

async function requireOwnedValidationLinks(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, projectId: string, pathId?: string | null, assumptionId?: string | null) {
  if (pathId) {
    const { data } = await supabase.from("validation_paths").select("id").eq("id", pathId).eq("project_id", projectId).eq("user_id", userId).maybeSingle();
    if (!data) throw new Error("The selected validation path does not belong to this project.");
  }
  if (assumptionId) {
    const { data } = await supabase.from("project_assumptions").select("id").eq("id", assumptionId).eq("project_id", projectId).eq("user_id", userId).maybeSingle();
    if (!data) throw new Error("The selected assumption does not belong to this project.");
  }
}

async function reconcileProgressSafely(userId: string, projectId: string, operation: string) {
  try {
    await reconcileProjectProgress(userId, projectId);
  } catch {
    await logBetaEvent({ userId, projectId, eventName: "progression_reconciliation_failed", source: "proof_board", metadata: { operation } });
  }
}

async function applyEvidenceGuidanceUpdate({
  userId,
  project,
  before,
  after,
  assumptionId,
  requestId,
  currentExperiment,
}: {
  userId: string;
  project: { id: string; status: string; report_json: unknown; is_synthetic?: boolean | null };
  before: ProjectValidationExperiment[];
  after: ProjectValidationExperiment[];
  assumptionId?: string | null;
  requestId?: string | null;
  currentExperiment: ProjectValidationExperiment;
}) {
  const report = project.report_json as OpportunityReport;
  const beforeRoute = routeValidationPath({ report, status: project.status as ProjectStatus, proof: summarizeProof(before), experiments: before });
  const afterRoute = routeValidationPath({ report, status: project.status as ProjectStatus, proof: summarizeProof(after), experiments: after });
  const beforeFingerprint = recommendationFingerprint({ assumptionKey: beforeRoute.targetAssumptionKey, action: beforeRoute.firstAction.action, evidenceType: beforeRoute.targetEvidenceType });
  const afterFingerprint = recommendationFingerprint({ assumptionKey: afterRoute.targetAssumptionKey, action: afterRoute.firstAction.action, evidenceType: afterRoute.targetEvidenceType });
  const assumptionStatus = evidenceStatus(currentExperiment);
  const admin = (await import("@/lib/supabase/admin")).createAdminClient();

  if (assumptionId) {
    await admin.from("project_assumptions").update({ status: assumptionStatus, source: "proof_board", updated_at: new Date().toISOString() }).eq("id", assumptionId).eq("project_id", project.id).eq("user_id", userId);
  }
  await logBetaEvent({ userId, projectId: project.id, eventName: "core_loop_evidence_saved", source: "proof_board", metadata: { request_id: requestId ?? null, evidence_type: currentExperiment.evidence_type ?? "other", assumption_status: assumptionStatus } });

  if (beforeFingerprint !== afterFingerprint) {
    await logBetaEvent({ userId, projectId: project.id, eventName: "core_loop_recommendation_updated", source: "proof_board", metadata: { request_id: requestId ?? null, previous_path: beforeRoute.pathType, next_path: afterRoute.pathType, changed: true } });
    if (!project.is_synthetic) await logBetaEvent({ userId, projectId: project.id, eventName: "core_loop_completed", source: "proof_board", metadata: { request_id: requestId ?? null, synthetic: false } });
  }
}

function evidenceStatus(experiment?: ProjectValidationExperiment): "untested" | "supported" | "contradicted" | "inconclusive" {
  if (!experiment) return "untested";
  const positive = experiment.pain_confirmed + experiment.interested_users + experiment.waitlist_signups + experiment.payment_intent + (experiment.preorders_or_revenue_cents > 0 ? 1 : 0);
  if (positive > 0) return "supported";
  if (experiment.status === "completed" && (experiment.people_contacted >= 3 || experiment.replies >= 3)) return "contradicted";
  if (experiment.status === "completed" || experiment.learnings?.trim()) return "inconclusive";
  return "untested";
}
