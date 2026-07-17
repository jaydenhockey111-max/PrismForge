"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { PROJECT_STATUSES } from "@/lib/founder-os/helpers";
import { validateProjectTitle } from "@/lib/founder-os/titleQuality";
import { getEffectivePlan } from "@/lib/billing/planLimits";
import { getFeatureCooldownSeconds, getFeatureUsagePolicy, planCanAccessFeature, type FeatureUsageKey } from "@/lib/billing/featurePolicy";
import type { Json, ProjectOutputType } from "@/lib/database.types";
import {
  generateExecutionOutputWithAI,
  generateStartupTeamOutputWithAI,
  type StartupTeamEmployee,
} from "@/lib/founder-os/aiProjectTools";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import { routeValidationPath } from "@/lib/founder-os/validationReadiness";
import { summarizeProof } from "@/lib/proof-board";
import type { SprintTaskOutput } from "@/lib/founder-os/executionTools";
import { trackUserAction } from "@/lib/gamification/server";
import { awardFounderProgress, reconcileProjectProgress } from "@/lib/progress/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logFeatureUsage } from "@/lib/usage/featureUsage";
import { getProjectPersonalization } from "@/lib/founder-intelligence/server";

const uuidSchema = z.string().uuid();
const statusSchema = z.enum(PROJECT_STATUSES);
const outputTypeSchema = z.enum([
  "landing_page_copy",
  "validation_survey",
  "competitive_battlecard",
  "pricing_tiers",
  "video_scripts",
  "sprint_tasks",
  "ceo_directive",
  "marketer_gtm_plan",
  "designer_wireframe",
  "engineer_boilerplate",
]);
const executableOutputTypeSchema = z.enum(["validation_survey", "competitive_battlecard", "pricing_tiers", "video_scripts", "sprint_tasks"]);
const startupEmployeeSchema = z.enum(["ceo", "marketer", "designer", "engineer"]);
const closureReflectionSchema = z.object({
  outcome: z.enum(["completed", "paused", "archived", "abandoned"]),
  whatWasLearned: z.string().trim().min(12).max(1200),
  strongestEvidence: z.string().trim().min(12).max(1200),
  biggestMistake: z.string().trim().max(1200).optional().default(""),
  closureReason: z.string().trim().min(12).max(1200),
  wouldDoDifferently: z.string().trim().min(12).max(1200),
});

export async function saveProjectClosureReflection(projectId: string, input: z.infer<typeof closureReflectionSchema>) {
  const profile = await requireProfile();
  const parsedId = uuidSchema.safeParse(projectId);
  const parsed = closureReflectionSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { ok: false as const, error: parsed.success ? "Invalid project id." : (parsed.error.issues[0]?.message ?? "Complete the reflection fields.") };
  const supabase = await createClient();
  const { data: project } = await supabase.from("opportunity_projects").select("id").eq("id", parsedId.data).eq("user_id", profile.id).maybeSingle();
  if (!project) return { ok: false as const, error: "Project not found." };
  const { data, error } = await supabase.from("project_closure_reflections").upsert({
    user_id: profile.id, project_id: parsedId.data, outcome: parsed.data.outcome,
    what_was_learned: parsed.data.whatWasLearned, strongest_evidence: parsed.data.strongestEvidence,
    biggest_mistake: parsed.data.biggestMistake || null, closure_reason: parsed.data.closureReason,
    would_do_differently: parsed.data.wouldDoDifferently,
  }, { onConflict: "user_id,project_id" }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Reflection could not be saved." };
  let awardedXp = 0;
  try {
    const award = await awardFounderProgress({
      userId: profile.id, projectId: parsedId.data, eventType: "project_closed_reflection", verificationLevel: "manual_detailed",
      sourceType: "reflection", sourceId: data.id, idempotencyKey: `reflection:${parsedId.data}:completed`,
      reason: "Closed or paused a project with a detailed lesson and evidence reflection.",
      metadata: { outcome: parsed.data.outcome },
    });
    awardedXp = award.awardedXp;
  } catch { /* Reflection saving remains available if progression is awaiting migration. */ }
  await logAuditEvent({ actorId: profile.id, action: "founder_project.reflection_saved", targetType: "opportunity_project", targetId: parsedId.data, metadata: { outcome: parsed.data.outcome } });
  await logBetaEvent({ userId: profile.id, projectId: parsedId.data, eventName: "closure_reflection_saved", source: "project_closure", metadata: { outcome: parsed.data.outcome, awarded_xp: awardedXp } });
  revalidatePath(`/projects/${parsedId.data}`);
  revalidatePath(`/projects/${parsedId.data}/timeline`);
  revalidatePath("/timeline");
  revalidatePath("/progress");
  return { ok: true as const, awardedXp };
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus, reason = "", requestId = crypto.randomUUID()) {
  const profile = await requireProfile();
  const parsedId = uuidSchema.safeParse(projectId);
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) throw new Error("Invalid project status update.");

  const parsedRequestId = uuidSchema.safeParse(requestId);
  if (!parsedRequestId.success) return { ok: false as const, error: "Invalid status request." };
  const supabase = await createClient();
  const { data: project } = await supabase.from("opportunity_projects").select("*").eq("id", parsedId.data).eq("user_id", profile.id).maybeSingle();
  if (!project) return { ok: false as const, error: "Project not found." };
  if (project.deleted_at || project.lifecycle_status !== "active") return { ok: false as const, error: "Resume or restore this project before changing its founder stage." };
  const [{ data: experiments }, { data: outputs }, { data: preference }, { data: activePath }] = await Promise.all([
    supabase.from("project_validation_experiments").select("*").eq("project_id", parsedId.data).eq("user_id", profile.id),
    supabase.from("project_outputs").select("*").eq("project_id", parsedId.data).eq("user_id", profile.id),
    supabase.from("founder_validation_preferences").select("preference").eq("project_id", parsedId.data).eq("user_id", profile.id).maybeSingle(),
    supabase.from("validation_paths").select("path_type,status").eq("project_id", parsedId.data).eq("user_id", profile.id).eq("status", "active").maybeSingle(),
  ]);
  const route = routeValidationPath({ report: project.report_json as unknown as OpportunityReport, status: project.status as ProjectStatus, proof: summarizeProof(experiments ?? []), experiments: experiments ?? [], outputs: outputs ?? [], preference: preference?.preference as never, forcedPath: activePath?.path_type as never });
  const conflict = parsedStatus.data !== route.suggestedStage;
  const cleanReason = reason.trim().replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, 1000);
  if (conflict && cleanReason.length < 12) {
    await logBetaEvent({ userId: profile.id, projectId: parsedId.data, eventName: "project_stage_conflict_detected", source: "project_status", metadata: { requested: parsedStatus.data, suggested: route.suggestedStage } });
    return { ok: false as const, needsReason: true as const, suggestedStatus: route.suggestedStage, error: `PrismForge suggests ${route.suggestedStage}. Add a short reason to choose ${parsedStatus.data} anyway.` };
  }
  const { error } = await supabase
    .from("opportunity_projects")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data)
    .eq("user_id", profile.id);
  if (error) return { ok: false as const, error: "Status could not be saved." };

  const admin = createAdminClient();
  await Promise.all([
    admin.from("project_stage_history").insert({ user_id: profile.id, project_id: parsedId.data, previous_stage: project.status, new_stage: parsedStatus.data, suggested_stage: route.suggestedStage, conflict, reason: cleanReason || null, request_id: parsedRequestId.data }),
    admin.from("project_lifecycle_events").insert({ user_id: profile.id, project_id: parsedId.data, event_type: "project_stage_changed", previous_status: project.status, next_status: parsedStatus.data, reason: cleanReason || null, request_id: parsedRequestId.data, metadata: { suggested_stage: route.suggestedStage, conflict } }),
  ]);
  await logBetaEvent({ userId: profile.id, projectId: parsedId.data, eventName: "project_stage_manually_changed", source: "project_status", metadata: { previous: project.status, next: parsedStatus.data, suggested: route.suggestedStage, conflict } });

  try { await reconcileProjectProgress(profile.id, parsedId.data); } catch { /* Project status changes remain available if progression is pending migration. */ }

  await logAuditEvent({ actorId: profile.id, action: "founder_project.status_updated", targetType: "opportunity_project", targetId: parsedId.data, metadata: { status: parsedStatus.data } });
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${parsedId.data}`);
  revalidatePath(`/projects/${parsedId.data}/timeline`);
  revalidatePath("/timeline");
  return { ok: true as const };
}

export async function renameProjectTitle(projectId: string, rawTitle: string) {
  const profile = await requireProfile();
  const parsedId = uuidSchema.safeParse(projectId);
  if (!parsedId.success) return { ok: false as const, error: "Invalid project id." };

  const validation = validateProjectTitle(rawTitle);
  if (!validation.valid) {
    await logBetaEvent({
      userId: profile.id,
      projectId: parsedId.data,
      eventName: "project_title_rename_failed",
      source: "project_title_editor",
      metadata: { reason: validation.reason ?? "invalid_title" },
    });
    return {
      ok: false as const,
      error: "Choose a clear project name like “Golf Practice Planner” or “Creator Sponsorship Toolkit.” Avoid sentences or placeholders.",
    };
  }

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("opportunity_projects")
    .select("id,title,lifecycle_status,deleted_at")
    .eq("id", parsedId.data)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (projectError || !project) {
    await logBetaEvent({
      userId: profile.id,
      projectId: parsedId.data,
      eventName: "project_title_rename_failed",
      source: "project_title_editor",
      metadata: { reason: projectError?.message ?? "project_not_found" },
    });
    return { ok: false as const, error: "Project not found." };
  }
  if (project.deleted_at || project.lifecycle_status !== "active") return { ok: false as const, error: "Resume or restore this project before renaming it." };

  const { error } = await supabase
    .from("opportunity_projects")
    .update({ title: validation.normalizedTitle })
    .eq("id", parsedId.data)
    .eq("user_id", profile.id);

  if (error) {
    await logBetaEvent({
      userId: profile.id,
      projectId: parsedId.data,
      eventName: "project_title_rename_failed",
      source: "project_title_editor",
      metadata: { reason: error.message },
    });
    return { ok: false as const, error: "Could not rename this project. Please try again." };
  }

  await logAuditEvent({
    actorId: profile.id,
    action: "founder_project.title_renamed",
    targetType: "opportunity_project",
    targetId: parsedId.data,
    metadata: { previous_title: project.title, next_title: validation.normalizedTitle },
  });
  await logBetaEvent({
    userId: profile.id,
    projectId: parsedId.data,
    eventName: "project_title_renamed",
    source: "project_title_editor",
    metadata: { title_length: validation.normalizedTitle.length },
  });

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/progress");
  revalidatePath(`/projects/${parsedId.data}`);
  revalidatePath(`/projects/${parsedId.data}/value-proof`);
  return { ok: true as const, title: validation.normalizedTitle };
}

export async function saveProjectOutput(projectId: string, outputType: ProjectOutputType, content: Json) {
  const profile = await requireProfile();
  const parsedId = uuidSchema.safeParse(projectId);
  const parsedType = outputTypeSchema.safeParse(outputType);
  if (!parsedId.success || !parsedType.success) throw new Error("Invalid project memory save.");
  if (!content || typeof content !== "object") throw new Error("Project memory content must be structured data.");

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("opportunity_projects")
    .select("id")
    .eq("id", parsedId.data)
    .eq("user_id", profile.id)
    .single();

  if (projectError || !project) throw new Error(projectError?.message ?? "Project not found.");

  const { data: existing } = await supabase
    .from("project_outputs")
    .select("id")
    .eq("project_id", parsedId.data)
    .eq("user_id", profile.id)
    .eq("output_type", parsedType.data)
    .maybeSingle();

  const { error } = await supabase.from("project_outputs").upsert(
    {
      project_id: parsedId.data,
      user_id: profile.id,
      output_type: parsedType.data,
      content_json: content,
    },
    { onConflict: "project_id,user_id,output_type" },
  );
  if (error) throw new Error(error.message);

  if (!existing) {
    try {
      await trackUserAction({
        userId: profile.id,
        action: "execution_output_saved",
        idempotencyKey: `execution_output_saved:${parsedId.data}:${parsedType.data}`,
        metadata: { project_id: parsedId.data, output_type: parsedType.data },
      });
    } catch {
      // CRM memory saving should not fail if XP tracking is temporarily unavailable.
    }
  }

  await logAuditEvent({
    actorId: profile.id,
    action: "founder_project.output_saved",
    targetType: "project_output",
    targetId: parsedId.data,
    metadata: { output_type: parsedType.data, first_save: !existing },
  });

  revalidatePath(`/projects/${parsedId.data}`);
  revalidatePath("/progress");
  return { saved: true, firstSave: !existing };
}

export async function generateExecutionOutput(projectId: string, outputType: ProjectOutputType, regenerate = false, requestId?: string) {
  const profile = await requireProfile();
  const parsedId = uuidSchema.safeParse(projectId);
  const parsedType = executableOutputTypeSchema.safeParse(outputType);
  if (!parsedId.success || !parsedType.success) throw new Error("Invalid AI execution request.");
  const feature = parsedType.data as FeatureUsageKey;
  const plan = getEffectivePlan(profile);
  const policy = getFeatureUsagePolicy(feature);
  const cooldownSeconds = getFeatureCooldownSeconds(feature, plan);
  if (!planCanAccessFeature(plan, feature)) throw new Error(`This AI feature requires ${policy.minPlan}.`);

  const supabase = await createClient();
  const [{ data: project, error }, { data: existing }] = await Promise.all([
    supabase
      .from("opportunity_projects")
      .select("id,report_json,lifecycle_status,deleted_at")
      .eq("id", parsedId.data)
      .eq("user_id", profile.id)
      .single(),
    supabase
      .from("project_outputs")
      .select("content_json,updated_at")
      .eq("project_id", parsedId.data)
      .eq("user_id", profile.id)
      .eq("output_type", parsedType.data)
      .maybeSingle(),
  ]);
  if (error || !project) throw new Error(error?.message ?? "Project not found.");
  if (project.deleted_at || project.lifecycle_status !== "active") throw new Error("Resume or restore this project before generating a new execution asset.");

  if (existing?.content_json && !regenerate) {
    await logFeatureUsage({ userId: profile.id, projectId: parsedId.data, feature, source: "cache", reason: "cached_project_output" });
    return { output: existing.content_json, mode: "cache" as const, fallbackReason: "Cached result reused. Regenerate only when you need a fresh AI answer." };
  }

  if (existing?.content_json && existing.updated_at && secondsSince(existing.updated_at) < cooldownSeconds) {
    await logFeatureUsage({ userId: profile.id, projectId: parsedId.data, feature, source: "cache", reason: "cooldown_active" });
    return { output: existing.content_json, mode: "cache" as const, fallbackReason: `Cooldown active. Reusing cached result for ${Math.ceil((cooldownSeconds - secondsSince(existing.updated_at)) / 60)} more minute(s).` };
  }

  const report = project.report_json as unknown as OpportunityReport;
  const result = await generateExecutionOutputWithAI(report, parsedType.data, {
    actor: { userId: profile.id, plan },
    projectId: parsedId.data,
    requestId,
    cacheBypass: regenerate,
    source: "project_execution",
  });
  await saveProjectOutput(parsedId.data, parsedType.data, result.value as unknown as Json);

  await logAuditEvent({
    actorId: profile.id,
    action: "founder_project.ai_execution_generated",
    targetType: "opportunity_project",
    targetId: parsedId.data,
    metadata: { output_type: parsedType.data, mode: result.mode },
  });

  return { output: result.value as unknown as Json, mode: result.mode, fallbackReason: result.fallbackReason ?? null };
}

export async function generateStartupTeamOutput(projectId: string, employee: StartupTeamEmployee, regenerate = false, requestId?: string) {
  const profile = await requireProfile();
  const parsedId = uuidSchema.safeParse(projectId);
  const parsedEmployee = startupEmployeeSchema.safeParse(employee);
  if (!parsedId.success || !parsedEmployee.success) throw new Error("Invalid AI employee request.");
  const feature = employeeFeature(parsedEmployee.data);
  const outputType = startupOutputType(parsedEmployee.data);
  const plan = getEffectivePlan(profile);
  const policy = getFeatureUsagePolicy(feature);
  const cooldownSeconds = getFeatureCooldownSeconds(feature, plan);
  if (!planCanAccessFeature(plan, feature)) throw new Error(`This AI employee requires ${policy.minPlan}.`);

  const supabase = await createClient();
  const [{ data: project, error }, { data: sprintOutput }, { data: existing }] = await Promise.all([
    supabase
      .from("opportunity_projects")
      .select("id,status,report_json,lifecycle_status,deleted_at")
      .eq("id", parsedId.data)
      .eq("user_id", profile.id)
      .single(),
    supabase
      .from("project_outputs")
      .select("content_json")
      .eq("project_id", parsedId.data)
      .eq("user_id", profile.id)
      .eq("output_type", "sprint_tasks")
      .maybeSingle(),
    supabase
      .from("project_outputs")
      .select("content_json,updated_at")
      .eq("project_id", parsedId.data)
      .eq("user_id", profile.id)
      .eq("output_type", outputType)
      .maybeSingle(),
  ]);
  if (error || !project) throw new Error(error?.message ?? "Project not found.");
  if (project.deleted_at || project.lifecycle_status !== "active") throw new Error("Resume or restore this project before consulting an AI specialist.");

  if (existing?.content_json && !regenerate) {
    await logFeatureUsage({ userId: profile.id, projectId: parsedId.data, feature, source: "cache", reason: "cached_startup_team_output" });
    return { output: existing.content_json, mode: "cache" as const, fallbackReason: "Cached AI employee output reused. Regenerate only when you need a fresh AI answer." };
  }

  if (existing?.content_json && existing.updated_at && secondsSince(existing.updated_at) < cooldownSeconds) {
    await logFeatureUsage({ userId: profile.id, projectId: parsedId.data, feature, source: "cache", reason: "cooldown_active" });
    return { output: existing.content_json, mode: "cache" as const, fallbackReason: `Cooldown active. Reusing cached result for ${Math.ceil((cooldownSeconds - secondsSince(existing.updated_at)) / 60)} more minute(s).` };
  }

  const report = project.report_json as unknown as OpportunityReport;
  const sprintTasks = Array.isArray(sprintOutput?.content_json) ? sprintOutput.content_json as unknown as SprintTaskOutput[] : undefined;
  const founderIntelligence = await getProjectPersonalization({
    userId: profile.id,
    projectType: report.input.businessType,
    hoursPerWeek: report.input.timePerWeek,
    status: project.status,
  });
  const result = await generateStartupTeamOutputWithAI({
    employee: parsedEmployee.data,
    report,
    status: project.status as ProjectStatus,
    sprintTasks,
    context: {
      actor: { userId: profile.id, plan },
      projectId: parsedId.data,
      requestId,
      cacheBypass: regenerate,
      source: "startup_team",
    },
    founderIntelligence: founderIntelligence.compactAiContext,
  });
  try {
    await saveProjectOutput(parsedId.data, outputType, result.value as unknown as Json);
  } catch (saveError) {
    await logFeatureUsage({
      userId: profile.id,
      projectId: parsedId.data,
      feature,
      source: "fallback",
      reason: saveError instanceof Error ? `startup_team_cache_save_failed:${saveError.message}` : "startup_team_cache_save_failed",
    });
  }

  await logAuditEvent({
    actorId: profile.id,
    action: "founder_project.ai_employee_generated",
    targetType: "opportunity_project",
    targetId: parsedId.data,
    metadata: { employee: parsedEmployee.data, mode: result.mode },
  });

  return { output: result.value as unknown as Json, mode: result.mode, fallbackReason: result.fallbackReason ?? null };
}

export async function logMarketPulseRefresh(projectId: string) {
  const profile = await requireProfile();
  const parsedId = uuidSchema.safeParse(projectId);
  if (!parsedId.success) return { ok: false, reason: "Invalid project id." };
  const supabase = await createClient();
  const { data: project } = await supabase.from("opportunity_projects").select("id,lifecycle_status,deleted_at").eq("id", parsedId.data).eq("user_id", profile.id).maybeSingle();
  if (!project) return { ok: false, reason: "Project not found." };
  if (project.deleted_at || project.lifecycle_status !== "active") return { ok: false, reason: "Resume or restore this project before refreshing Market Pulse." };
  const feature: FeatureUsageKey = "market_pulse_refresh";
  const plan = getEffectivePlan(profile);
  const cooldownSeconds = getFeatureCooldownSeconds(feature, plan);
  const pulseOk = await checkRateLimit({ key: `market_pulse_local:${profile.id}:${parsedId.data}`, limit: 1, windowSeconds: cooldownSeconds });
  if (!pulseOk) {
    await logFeatureUsage({ userId: profile.id, projectId: parsedId.data, feature, source: "blocked", reason: "market_pulse_cooldown", success: false, errorCategory: "cooldown" });
    return { ok: false, reason: "Market Pulse cooldown active. Try again later." };
  }
  await logFeatureUsage({ userId: profile.id, projectId: parsedId.data, feature, source: "fallback", reason: "local_market_pulse_refresh" });
  return { ok: true, reason: null };
}

function employeeFeature(employee: StartupTeamEmployee): FeatureUsageKey {
  if (employee === "ceo") return "ceo_ai";
  if (employee === "marketer") return "marketer_ai";
  if (employee === "designer") return "designer_ai";
  return "engineer_ai";
}

function startupOutputType(employee: StartupTeamEmployee): ProjectOutputType {
  if (employee === "ceo") return "ceo_directive";
  if (employee === "marketer") return "marketer_gtm_plan";
  if (employee === "designer") return "designer_wireframe";
  return "engineer_boilerplate";
}

function secondsSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
}
