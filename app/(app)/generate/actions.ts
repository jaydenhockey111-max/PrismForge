"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { getEffectivePlan, getPlanLimits, isUnlimited } from "@/lib/billing/planLimits";
import { getFeatureUsagePolicy, planCanAccessFeature } from "@/lib/billing/featurePolicy";
import type { Json } from "@/lib/database.types";
import { assessFounderInputCoherence, canonicalInputKey } from "@/lib/founder-os/generationInput";
import { hasLowQualityProjectOutput, sanitizeFounderInput } from "@/lib/founder-os/guidedIdeaRecovery";
import { createMockOpportunityReport, generateOpportunityReport } from "@/lib/founder-os/reportGenerator";
import { validateGeneratedReport } from "@/lib/founder-os/reportQuality";
import { cleanProjectTitle } from "@/lib/founder-os/titleQuality";
import type { OpportunityReport, UserOpportunityInput } from "@/lib/founder-os/types";
import { userOpportunityInputSchema } from "@/lib/founder-os/validation";
import { trackUserAction } from "@/lib/gamification/server";
import { reconcileProjectProgress } from "@/lib/progress/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logFeatureUsage } from "@/lib/usage/featureUsage";

export async function generateFounderProject(formData: FormData) {
  const profile = await requireProfile();
  const startedAt = Date.now();
  const raw = Object.fromEntries(formData.entries());
  const requestId = parseRequestId(raw.generationRequestId);

  const duplicateState = await findGenerationStateForRequest(profile.id, requestId);
  if (duplicateState.status === "completed") {
    await logBetaEvent({ userId: profile.id, projectId: duplicateState.projectId, eventName: "project_generation_duplicate_prevented", source: "generate_action", metadata: { request_id: requestId, project_id: duplicateState.projectId, state: "completed" } });
    await logBetaEvent({ userId: profile.id, projectId: duplicateState.projectId, eventName: "duplicate_submission_blocked", source: "generate_action", metadata: { request_id: requestId, project_id: duplicateState.projectId } });
    redirect(`/projects/${duplicateState.projectId}?${new URLSearchParams({ message: "Your project was already created, so PrismForge opened it instead of generating a duplicate." }).toString()}`);
  }
  if (duplicateState.status === "in_progress") {
    await logBetaEvent({ userId: profile.id, eventName: "project_generation_duplicate_prevented", source: "generate_action", metadata: { request_id: requestId, state: "in_progress" } });
    redirect(`/generate?error=${encodeURIComponent("That project is still being created. Give it a moment before retrying — duplicate protection is active.")}`);
  }

  await logGenerationStage({ userId: profile.id, requestId, stage: "request_started", startedAt });
  await logBetaEvent({ userId: profile.id, eventName: "project_creation_request_received", source: "generate_action", metadata: { request_id: requestId } });
  await logBetaEvent({ userId: profile.id, eventName: "project_generation_started", source: "generate_action", metadata: { request_id: requestId } });
  await logBetaEvent({ userId: profile.id, eventName: "generate_project_started", source: "generate_action", metadata: { request_id: requestId } });
  await logBetaEvent({ userId: profile.id, eventName: "project_creation_started", source: "generate_action", metadata: { request_id: requestId } });

  const parsed = userOpportunityInputSchema.safeParse(raw);
  if (!parsed.success) {
    await logGenerationStage({ userId: profile.id, requestId, stage: "input_validation_failed", startedAt, errorCategory: "input" });
    await logBetaEvent({ userId: profile.id, eventName: "project_generation_input_rejected", source: "generate_action", metadata: { request_id: requestId, issue_count: parsed.error.issues.length, duration_ms: Date.now() - startedAt, error_category: "invalid_input" } });
    await logBetaEvent({ userId: profile.id, eventName: "project_creation_validation_failed", source: "generate_action", metadata: { request_id: requestId, issue_count: parsed.error.issues.length, duration_ms: Date.now() - startedAt } });
    await logBetaEvent({ userId: profile.id, eventName: "generate_project_failed", source: "generate_action", metadata: { request_id: requestId, reason: "invalid_input", duration_ms: Date.now() - startedAt } });
    redirect(`/generate?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "We need a little more information before creating a useful project.")}`);
  }

  await logGenerationStage({ userId: profile.id, requestId, stage: "input_validation_passed", startedAt });
  const coherence = assessFounderInputCoherence(parsed.data);
  if (!coherence.ok) {
    await logGenerationStage({ userId: profile.id, requestId, stage: "input_coherence_failed", startedAt, errorCategory: coherence.category });
    await logBetaEvent({ userId: profile.id, eventName: "project_generation_input_rejected", source: "generate_action", metadata: { request_id: requestId, reason: "coherence_failed", duration_ms: Date.now() - startedAt, error_category: coherence.category } });
    await logBetaEvent({ userId: profile.id, eventName: "generate_project_failed", source: "generate_action", metadata: { request_id: requestId, reason: "coherence_failed", duration_ms: Date.now() - startedAt } });
    redirect(`/generate?error=${encodeURIComponent(coherence.error)}`);
  }

  const sanitized = sanitizeFounderInput(coherence.input);
  if (sanitized.recoveredFields.length) {
    await logGenerationStage({ userId: profile.id, requestId, stage: "guided_recovery_used", startedAt, metadata: { recovered_fields: sanitized.recoveredFields } });
    await logInputRecoveryEvent(profile.id, "placeholder_input_detected", { fields: sanitized.recoveredFields, recovery_method: "local_guided_idea" });
    if (sanitized.guidedIdeaUsed) {
      await logInputRecoveryEvent(profile.id, "local_idea_recovery_used", { option_count: sanitized.guidedIdeaOptions.length });
      await logBetaEvent({ userId: profile.id, eventName: "guided_idea_mode_opened", source: "generate_action", metadata: { request_id: requestId, recovered_count: sanitized.recoveredFields.length } });
    }
  }

  if (!(await checkRateLimit({ key: `founder_generate:${profile.id}`, limit: 12, windowSeconds: 60 * 60 }))) {
    await logGenerationStage({ userId: profile.id, requestId, stage: "rate_limited", startedAt, errorCategory: "rate_limit" });
    redirect("/generate?error=Generation%20rate%20limit%20reached.%20Give%20PrismForge%20a%20little%20breathing%20room.");
  }

  const supabase = await createClient();
  const limits = getPlanLimits(profile);
  const plan = getEffectivePlan(profile);
  const reportPolicy = getFeatureUsagePolicy("opportunity_report");
  if (!planCanAccessFeature(plan, "opportunity_report")) redirect(`/pricing?error=${encodeURIComponent(`Founder reports require ${reportPolicy.minPlan}.`)}`);

  const reusableProject = await findReusableProjectForInput(supabase, profile.id, sanitized);
  if (reusableProject) {
    await logFeatureUsage({ userId: profile.id, projectId: reusableProject.id, feature: "opportunity_report", source: "cache", reason: "matching_saved_project_report", success: true });
    await logGenerationStage({ userId: profile.id, projectId: reusableProject.id, requestId, stage: "duplicate_input_reused", startedAt, source: "cache" });
    await logBetaEvent({ userId: profile.id, projectId: reusableProject.id, eventName: "duplicate_submission_blocked", source: "generate_action", metadata: { request_id: requestId, project_id: reusableProject.id, reason: "matching_saved_project_report" } });
    redirect(`/projects/${reusableProject.id}?${new URLSearchParams({ message: "Using your saved report for this same project idea." }).toString()}`);
  }

  if (!isUnlimited(limits.reportsPerMonth)) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count, error } = await (supabase as any)
      .from("generation_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .gte("created_at", monthStart.toISOString());
    if (!error && (count ?? 0) >= limits.reportsPerMonth) redirect(`/pricing?error=${encodeURIComponent(`Your current plan includes ${limits.reportsPerMonth} founder reports per month.`)}`);
  }

  if (!isUnlimited(limits.savedProjects)) {
    const { count, error } = await (supabase as any)
      .from("opportunity_projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("deleted_at", null);
    if (!error && (count ?? 0) >= limits.savedProjects) redirect(`/pricing?error=${encodeURIComponent(`Your current plan includes ${limits.savedProjects} saved projects.`)}`);
  }

  let report = await createReportWithReliableFallback({ input: sanitized, userId: profile.id, requestId, startedAt, plan });
  const reportValidation = validateGeneratedReport(report, sanitized);
  if (!reportValidation.ok) {
    await logGenerationStage({ userId: profile.id, requestId, stage: "report_validation_failed_fallback_attempted", startedAt, source: report.generationMode === "openai" ? "openai" : "fallback", errorCategory: reportValidation.category, metadata: { reason: reportValidation.reason } });
    await logBetaEvent({ userId: profile.id, eventName: "project_generation_fallback_used", source: "generate_action", metadata: { request_id: requestId, reason: reportValidation.reason, duration_ms: Date.now() - startedAt } });
    report = { ...createMockOpportunityReport(sanitized), fallbackReason: `Generated output was rejected: ${reportValidation.reason}`, generationMode: "mock" as const };
  } else {
    report = reportValidation.report;
  }
  const finalReportValidation = validateGeneratedReport(report, sanitized);
  if (!finalReportValidation.ok) {
    await logGenerationStage({ userId: profile.id, requestId, stage: "fallback_validation_failed", startedAt, source: "fallback", errorCategory: finalReportValidation.category, metadata: { reason: finalReportValidation.reason } });
    await logBetaEvent({ userId: profile.id, eventName: "project_generation_failed", source: "generate_action", metadata: { request_id: requestId, reason: "fallback_validation_failed", duration_ms: Date.now() - startedAt } });
    redirect(`/generate?error=${encodeURIComponent("We couldn’t create the project this time. Your answers are still here, so you can try again.")}`);
  }
  report = finalReportValidation.report;
  await logTrustValidationEvents({
    userId: profile.id,
    requestId,
    warnings: finalReportValidation.warnings,
  });
  const titleRepair = cleanProjectTitle(report.summary.title, {
    audience: report.summary.targetCustomer || sanitized.targetAudience,
    painPoint: report.summary.painPoint,
    businessType: sanitized.businessType,
    interests: sanitized.interests,
    skills: sanitized.skills,
    existingIdea: sanitized.existingIdea,
  });
  if (titleRepair.repaired) {
    report = { ...report, summary: { ...report.summary, title: titleRepair.title } };
    await logBetaEvent({ userId: profile.id, eventName: "project_title_rejected", source: "generate_action", metadata: { request_id: requestId, reason: titleRepair.reason ?? "title_quality_guard" } });
    await logBetaEvent({ userId: profile.id, eventName: titleRepair.source === "fallback" ? "project_title_fallback_used" : "project_title_auto_repaired", source: "generate_action", metadata: { request_id: requestId, reason: titleRepair.reason ?? "title_quality_guard", repaired_title: titleRepair.title } });
  } else {
    await logBetaEvent({ userId: profile.id, eventName: "project_title_generated_valid", source: "generate_action", metadata: { request_id: requestId, title_length: titleRepair.title.length } });
  }

  if (hasLowQualityProjectOutput({ title: report.summary.title, targetAudience: report.summary.targetCustomer, painPoint: report.summary.painPoint })) {
    await logGenerationStage({ userId: profile.id, requestId, stage: "quality_guard_failed", startedAt, source: report.generationMode === "openai" ? "openai" : "fallback", errorCategory: "quality" });
    await logBetaEvent({ userId: profile.id, eventName: "generate_project_failed", source: "generate_action", metadata: { request_id: requestId, reason: "low_quality_output", generation_mode: report.generationMode, duration_ms: Date.now() - startedAt } });
    await logInputRecoveryEvent(profile.id, "project_generation_blocked_low_quality", { generation_mode: report.generationMode, recovered_fields: sanitized.recoveredFields });
    redirect(`/generate?error=${encodeURIComponent("PrismForge could not create a coherent project from those answers. Try adding one real interest, skill, or target audience — or leave the idea field blank for Guided Idea Mode.")}`);
  }

  await logGenerationStage({ userId: profile.id, requestId, stage: "project_insert_started", startedAt, source: report.generationMode === "openai" ? "openai" : "fallback" });
  await logBetaEvent({ userId: profile.id, eventName: "project_save_started", source: "generate_action", metadata: { request_id: requestId, generation_mode: report.generationMode, duration_ms: Date.now() - startedAt } });

  const { projectId, error: projectError } = await createFounderProjectRecord({
    supabase,
    userId: profile.id,
    requestId,
    input: sanitized,
    report,
  });

  if (projectError || !projectId) {
    await logGenerationStage({ userId: profile.id, requestId, stage: "project_insert_failed", startedAt, source: report.generationMode === "openai" ? "openai" : "fallback", errorCategory: "save" });
    await logBetaEvent({ userId: profile.id, eventName: "project_save_failed", source: "generate_action", metadata: { request_id: requestId, reason: "database_save_failed", duration_ms: Date.now() - startedAt } });
    await logBetaEvent({ userId: profile.id, eventName: "project_generation_failed", source: "generate_action", metadata: { request_id: requestId, reason: "database_save_failed", duration_ms: Date.now() - startedAt } });
    await logBetaEvent({ userId: profile.id, eventName: "generate_project_failed", source: "generate_action", metadata: { request_id: requestId, reason: "database_save_failed", duration_ms: Date.now() - startedAt } });
    redirect(`/generate?error=${encodeURIComponent("Your project plan was created, but we could not save it. Please retry.")}`);
  }

  await logGenerationStage({ userId: profile.id, projectId, requestId, stage: "project_insert_succeeded", startedAt, source: report.generationMode === "openai" ? "openai" : "fallback" });
  await logBetaEvent({ userId: profile.id, projectId, eventName: "project_save_completed", source: "generate_action", metadata: { request_id: requestId, project_id: projectId, duration_ms: Date.now() - startedAt } });
  await logBetaEvent({ userId: profile.id, projectId, eventName: "project_database_save_completed", source: "generate_action", metadata: { request_id: requestId, project_id: projectId, duration_ms: Date.now() - startedAt } });
  const { count: ownedProjectCount } = await supabase.from("opportunity_projects").select("*", { count: "exact", head: true }).eq("user_id", profile.id).is("deleted_at", null);
  await logBetaEvent({ userId: profile.id, projectId, eventName: "core_loop_project_created", source: "generate_action", metadata: { request_id: requestId, project_number: ownedProjectCount ?? 1, synthetic: false } });
  if ((ownedProjectCount ?? 1) >= 2) await logBetaEvent({ userId: profile.id, projectId, eventName: "core_loop_second_project_created", source: "generate_action", metadata: { request_id: requestId, project_number: ownedProjectCount ?? 2 } });
  try {
    await reconcileProjectProgress(profile.id, projectId);
  } catch {
    await logBetaEvent({ userId: profile.id, projectId, eventName: "progression_reconciliation_failed", source: "generate_action", metadata: { request_id: requestId, operation: "project_created" } });
  }

  const historyError = null;
  await logGenerationStage({
    userId: profile.id,
    projectId,
    requestId,
    stage: historyError ? "optional_history_insert_failed" : "optional_history_insert_succeeded",
    startedAt,
    source: report.generationMode === "openai" ? "openai" : "fallback",
    errorCategory: historyError ? "optional_insert" : undefined,
  });

  let params = new URLSearchParams({ message: "Your project is ready. Start with the Next Best Action." });
  try {
    const result = await trackUserAction({
      userId: profile.id,
      action: "founder_report_generated",
      idempotencyKey: `founder_report_generated:${projectId}`,
      metadata: { project_id: projectId, score: report.score.overall },
    });
    const reward = "rewards" in result ? result.rewards?.[0] : null;
    if (reward) {
      params.set("chest", "1");
      params.set("reward", reward.name);
      params.set("rewardDescription", reward.description);
    }
    if ("leveledUp" in result && result.leveledUp) params.set("levelUp", String(result.levelAfter));
  } catch {
    params = new URLSearchParams({ message: "Your project is ready. Start with the Next Best Action." });
  }

  await logAuditEvent({
    actorId: profile.id,
    action: "founder_project.generated",
    targetType: "opportunity_project",
    targetId: projectId,
    metadata: { score: report.score.overall, business_type: sanitized.businessType, generation_mode: report.generationMode, recovered_fields: sanitized.recoveredFields },
  });
  await logBetaEvent({ userId: profile.id, projectId, eventName: "project_generation_completed", source: "generate_action", metadata: { request_id: requestId, score: report.score.overall, generation_mode: report.generationMode, duration_ms: Date.now() - startedAt, project_id: projectId } });
  await logBetaEvent({ userId: profile.id, projectId, eventName: "generate_project_completed", source: "generate_action", metadata: { request_id: requestId, score: report.score.overall, business_type: sanitized.businessType, generation_mode: report.generationMode, duration_ms: Date.now() - startedAt, project_id: projectId } });
  await logBetaEvent({ userId: profile.id, projectId, eventName: "project_creation_completed", source: "generate_action", metadata: { request_id: requestId, score: report.score.overall, generation_mode: report.generationMode, duration_ms: Date.now() - startedAt, project_id: projectId } });
  await logGenerationStage({ userId: profile.id, projectId, requestId, stage: "redirect_target_created", startedAt, source: report.generationMode === "openai" ? "openai" : "fallback" });
  await logBetaEvent({ userId: profile.id, projectId, eventName: "project_redirect_started", source: "generate_action", metadata: { request_id: requestId, project_id: projectId, duration_ms: Date.now() - startedAt } });

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect(`/projects/${projectId}?${params.toString()}`);
}

async function createReportWithReliableFallback({
  input,
  userId,
  requestId,
  startedAt,
  plan,
}: {
  input: UserOpportunityInput;
  userId: string;
  requestId: string;
  startedAt: number;
  plan: ReturnType<typeof getEffectivePlan>;
}) {
  try {
    await logGenerationStage({ userId, requestId, stage: "openai_attempted", startedAt, source: "openai" });
    await logBetaEvent({ userId, eventName: "openai_generation_started", source: "generate_action", metadata: { request_id: requestId } });
    const report = await generateOpportunityReport(input, {
      actor: { userId, plan },
      requestId,
      source: "generate_project",
    });
    await logGenerationStage({
      userId,
      requestId,
      stage: report.generationMode === "openai" ? "openai_succeeded" : "local_fallback_used",
      startedAt,
      source: report.generationMode === "openai" ? "openai" : "fallback",
      metadata: { fallback_reason: report.fallbackReason ?? null },
    });
    await logBetaEvent({
      userId,
      eventName: report.generationMode === "openai" ? "openai_generation_completed" : "local_fallback_used",
      source: "generate_action",
      metadata: { request_id: requestId, fallback_reason: report.fallbackReason ?? null, duration_ms: Date.now() - startedAt },
    });
    await logBetaEvent({
      userId,
      eventName: report.generationMode === "openai" ? "project_generation_ai_succeeded" : "project_generation_fallback_used",
      source: "generate_action",
      metadata: { request_id: requestId, fallback_reason: report.fallbackReason ?? null, duration_ms: Date.now() - startedAt },
    });
    return report;
  } catch {
    await logGenerationStage({ userId, requestId, stage: "generation_failed", startedAt, errorCategory: "generation" });
    await logBetaEvent({ userId, eventName: "openai_generation_failed", source: "generate_action", metadata: { request_id: requestId, reason: "report_generation_failed", duration_ms: Date.now() - startedAt } });
    await logGenerationStage({ userId, requestId, stage: "local_fallback_used_after_generation_error", startedAt, source: "fallback", errorCategory: "generation" });
    await logBetaEvent({ userId, eventName: "local_fallback_used", source: "generate_action", metadata: { request_id: requestId, reason: "generation_error", duration_ms: Date.now() - startedAt } });
    await logBetaEvent({ userId, eventName: "project_generation_fallback_used", source: "generate_action", metadata: { request_id: requestId, reason: "generation_error", duration_ms: Date.now() - startedAt } });
    return {
      ...createMockOpportunityReport(input),
      fallbackReason: "The AI response did not finish, so PrismForge switched to a reliable local version.",
      generationMode: "mock" as const,
    };
  }
}

async function logInputRecoveryEvent(userId: string, eventName: string, metadata: Record<string, Json>) {
  try {
    const admin = createAdminClient();
    await admin.from("app_events").insert({ user_id: userId, event_name: eventName, metadata });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[input-quality] event logging failed", error);
  }
}

async function logTrustValidationEvents({ userId, requestId, warnings }: { userId: string; requestId: string; warnings: string[] }) {
  const trustWarnings = warnings.filter((warning) => warning.startsWith("trust:"));
  const valueWarnings = warnings.filter((warning) => warning.startsWith("value:"));

  if (valueWarnings.length) {
    await logBetaEvent({
      userId,
      eventName: "ai_output_regurgitation_detected",
      source: "generate_action",
      metadata: {
        request_id: requestId,
        warning_count: valueWarnings.length,
        repaired_count: valueWarnings.filter((warning) => warning.includes("fallback_replaced") || warning.includes("preserved_original")).length,
      },
    });
    await logBetaEvent({
      userId,
      eventName: "ai_output_fallback_used",
      source: "generate_action",
      metadata: { request_id: requestId, reason: "value_added_guard", warning_count: valueWarnings.length },
    });
  }

  if (!trustWarnings.length) return;

  const categories = Array.from(new Set(trustWarnings.map((warning) => warning.replace(/^trust:/, "")).slice(0, 8)));
  const metadata = {
    request_id: requestId,
    category_count: categories.length,
    categories,
  };

  await logBetaEvent({ userId, eventName: "trust_validator_triggered", source: "generate_action", metadata });
  await logBetaEvent({ userId, eventName: "unsupported_claim_removed", source: "generate_action", metadata });
  if (categories.some((category) => /fake_|unsupported_certainty/.test(category))) {
    await logBetaEvent({ userId, eventName: "hallucination_detected", source: "generate_action", metadata });
  }
  await logBetaEvent({ userId, eventName: "hypothesis_created", source: "generate_action", metadata: { request_id: requestId, source: "trust_engine" } });
  await logBetaEvent({ userId, eventName: "assumption_created", source: "generate_action", metadata: { request_id: requestId, source: "trust_engine" } });
}

async function findReusableProjectForInput(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: UserOpportunityInput,
): Promise<{ id: string; generationMode: OpportunityReport["generationMode"] } | null> {
  const inputKey = canonicalInputKey(input);
  const { data, error } = await supabase
    .from("opportunity_projects")
    .select("id, report_json, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error || !data) return null;

  for (const project of data) {
    const report = project.report_json as unknown as Partial<OpportunityReport> | null;
    if (!report?.input) continue;
    if (canonicalInputKey(report.input) === inputKey) {
      return { id: project.id, generationMode: report.generationMode === "openai" ? "openai" : "mock" };
    }
  }

  return null;
}

function parseRequestId(value: unknown) {
  const raw = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw) ? raw : crypto.randomUUID();
}

async function findGenerationStateForRequest(userId: string, requestId: string): Promise<{ status: "none" } | { status: "completed"; projectId: string } | { status: "in_progress" }> {
  try {
    const admin = createAdminClient();
    const { data: completed } = await admin
      .from("app_events")
      .select("metadata")
      .eq("user_id", userId)
      .eq("event_name", "generate_project_completed")
      .filter("metadata->>request_id", "eq", requestId)
      .order("created_at", { ascending: false })
      .limit(1);
    const metadata = completed?.[0]?.metadata as Record<string, Json | undefined> | undefined;
    const projectId = typeof metadata?.project_id === "string" ? metadata.project_id : null;
    if (projectId && /^[0-9a-f-]{36}$/i.test(projectId)) return { status: "completed", projectId };

    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: active } = await admin
      .from("app_events")
      .select("id")
      .eq("user_id", userId)
      .in("event_name", ["project_generation_started", "generate_project_started"])
      .filter("metadata->>request_id", "eq", requestId)
      .gte("created_at", since)
      .limit(1);
    if (active?.length) return { status: "in_progress" };
  } catch {
    return { status: "none" };
  }
  return { status: "none" };
}

async function createFounderProjectRecord({
  supabase,
  userId,
  requestId,
  input,
  report,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  requestId: string;
  input: UserOpportunityInput;
  report: OpportunityReport;
}): Promise<{ projectId: string | null; error: unknown | null }> {
  const inputJson = input as unknown as Json;
  const outputJson = report as unknown as Json;
  const payload = {
    p_request_id: requestId,
    p_title: report.summary.title,
    p_business_type: input.businessType,
    p_target_customer: report.summary.targetCustomer,
    p_score: report.score.overall,
    p_report_json: outputJson,
    p_input_json: inputJson,
  };

  const rpcBuilder = (supabase as any).rpc("create_founder_project_atomic", payload);
  const rpc = typeof rpcBuilder.maybeSingle === "function" ? await rpcBuilder.maybeSingle() : await rpcBuilder;
  if (!rpc.error && rpc.data) {
    const projectId = typeof rpc.data === "string" ? rpc.data : typeof rpc.data?.project_id === "string" ? rpc.data.project_id : null;
    if (projectId) {
      await registerCreatedProjectLifecycle(supabase, projectId, requestId);
      return { projectId, error: null };
    }
  }

  const { data: project, error: projectError } = await supabase
    .from("opportunity_projects")
    .insert({
      user_id: userId,
      title: report.summary.title,
      business_type: input.businessType,
      target_customer: report.summary.targetCustomer,
      score: report.score.overall,
      report_json: outputJson,
    })
    .select("id")
    .single();

  if (projectError || !project) return { projectId: null, error: projectError ?? new Error("Project insert returned no row.") };

  const { error: historyError } = await supabase.from("generation_history").insert({
    user_id: userId,
    input_json: inputJson,
    output_json: outputJson,
  });

  if (historyError) {
    await createAdminClient().from("opportunity_projects").delete().eq("id", project.id).eq("user_id", userId);
    return { projectId: null, error: historyError };
  }

  await registerCreatedProjectLifecycle(supabase, project.id, requestId);
  return { projectId: project.id, error: null };
}

async function registerCreatedProjectLifecycle(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, requestId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return;
  try { await supabase.rpc("register_project_creation_lifecycle", { p_project_id: projectId, p_request_id: requestId }); } catch { /* Creation remains successful if lifecycle migration is not live yet. */ }
}

async function logGenerationStage({
  userId,
  projectId,
  requestId,
  stage,
  startedAt,
  source,
  errorCategory,
  metadata = {},
}: {
  userId: string;
  projectId?: string | null;
  requestId: string;
  stage: string;
  startedAt: number;
  source?: "openai" | "fallback" | "cache" | "blocked";
  errorCategory?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  const eventMetadata = {
    ...metadata,
    request_id: requestId,
    project_id: projectId ?? null,
    stage,
    generation_source: source ?? null,
    error_category: errorCategory ?? null,
    duration_ms: Date.now() - startedAt,
  };

  await logBetaEvent({ userId, projectId, eventName: "generation_diagnostic", source: "generate_action", metadata: eventMetadata });
  await logBetaEvent({ userId, projectId, eventName: "project_creation_stage_changed", source: "generate_action", metadata: eventMetadata });
}
