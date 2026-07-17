"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import { FOUNDER_VALIDATION_PREFERENCES, VALIDATION_PATH_TYPES, routeValidationPath } from "@/lib/founder-os/validationReadiness";
import { appendPathEvent, pathInsert } from "@/lib/founder-os/validationWorkspace.server";
import { summarizeProof } from "@/lib/proof-board";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();
const preferenceSchema = z.enum(FOUNDER_VALIDATION_PREFERENCES);
const pathSchema = z.enum(VALIDATION_PATH_TYPES);
const decisionSchema = z.enum(["continue","narrow_audience","revise_problem","revise_solution","test_another_segment","test_pricing","build_prototype","pause","abandon","launch"]);
const decisionHistorySchema = z.object({
  previousAssumption: z.string().trim().max(1000).optional().default(""),
  newAssumption: z.string().trim().max(1000).optional().default(""),
  evidenceSummary: z.string().trim().max(1500).optional().default(""),
  outcome: z.string().trim().max(1500).optional().default(""),
});
const assumptionSchema = z.string().trim().min(8, "Write a question or assumption with at least 8 characters.").max(1000);

export async function saveFounderValidationPreference(projectId: string, preference: string, reason = "") {
  const profile = await requireProfile();
  const projectKey = uuid.safeParse(projectId);
  const value = preferenceSchema.safeParse(preference);
  if (!projectKey.success || !value.success) return { ok: false as const, error: "Choose a valid preference." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!(await ownsProject(supabase, profile.id, projectKey.data))) return { ok: false as const, error: "Project not found." };
  const { error } = await admin.from("founder_validation_preferences").upsert({ user_id: profile.id, project_id: projectKey.data, preference: value.data, reason: clean(reason, 500) || null, updated_at: new Date().toISOString() }, { onConflict: "user_id,project_id" });
  if (error) return migrationError(error.message);
  await logBetaEvent({ userId: profile.id, projectId: projectKey.data, eventName: "founder_validation_preference_saved", source: "validation_workspace", metadata: { preference: value.data } });
  revalidatePath(`/projects/${projectKey.data}`);
  return { ok: true as const };
}

export async function switchValidationPath(projectId: string, requestedPath: string, reason: string, requestId: string) {
  const profile = await requireProfile();
  const projectKey = uuid.safeParse(projectId); const path = pathSchema.safeParse(requestedPath); const request = uuid.safeParse(requestId);
  if (!projectKey.success || !path.success || !request.success) return { ok: false as const, error: "Invalid path request." };
  const cleanReason = clean(reason, 1000);
  if (cleanReason.length < 12) return { ok: false as const, error: "Explain briefly why this path fits better." };
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: project } = await supabase.from("opportunity_projects").select("*").eq("id", projectKey.data).eq("user_id", profile.id).maybeSingle();
  if (!project) return { ok: false as const, error: "Project not found." };
  const [{ data: experiments }, { data: outputs }, { data: preference }, { data: history }, { count: recentSwitches }] = await Promise.all([
    supabase.from("project_validation_experiments").select("*").eq("project_id", projectKey.data).eq("user_id", profile.id),
    supabase.from("project_outputs").select("*").eq("project_id", projectKey.data).eq("user_id", profile.id),
    supabase.from("founder_validation_preferences").select("preference").eq("project_id", projectKey.data).eq("user_id", profile.id).maybeSingle(),
    supabase.from("validation_paths").select("*").eq("project_id", projectKey.data).eq("user_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("validation_path_events").select("*", { count: "exact", head: true }).eq("project_id", projectKey.data).eq("user_id", profile.id).eq("event_type", "alternative_selected").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);
  if ((recentSwitches ?? 0) >= 2) return { ok: false as const, error: "You have changed paths twice this week. Record evidence from the active path before changing again." };
  const proof = summarizeProof(experiments ?? []);
  const base = routeValidationPath({ report: project.report_json as unknown as OpportunityReport, status: project.status as ProjectStatus, proof, experiments: experiments ?? [], outputs: outputs ?? [], preference: preference?.preference as never, pathHistory: (history ?? []).map((row) => ({ path_type: row.path_type as never, status: row.status })) });
  if (!base.alternatives.some((alternative) => alternative.pathType === path.data)) return { ok: false as const, error: "That path is not one of the safe alternatives for this project right now." };
  const active = (history ?? []).find((row) => row.status === "active");
  const selected = routeValidationPath({ report: project.report_json as unknown as OpportunityReport, status: project.status as ProjectStatus, proof, experiments: experiments ?? [], outputs: outputs ?? [], preference: preference?.preference as never, pathHistory: (history ?? []).map((row) => ({ path_type: row.path_type as never, status: row.status })), forcedPath: path.data });
  if (active) await admin.from("validation_paths").update({ status: "replaced", replaced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", active.id).eq("user_id", profile.id);
  const { data: created, error } = await admin.from("validation_paths").insert(pathInsert(profile.id, projectKey.data, selected, "founder", cleanReason)).select("id").single();
  if (error || !created) return migrationError(error?.message ?? "Path could not be changed.");
  await appendPathEvent(admin, profile.id, projectKey.data, created.id, "alternative_selected", active?.path_type ?? null, path.data, cleanReason, request.data);
  await logBetaEvent({ userId: profile.id, projectId: projectKey.data, eventName: "validation_path_alternative_selected", source: "validation_workspace", metadata: { previous_path: active?.path_type ?? null, next_path: path.data } });
  revalidatePath(`/projects/${projectKey.data}`);
  return { ok: true as const };
}

export async function recordProjectDecision(projectId: string, decision: string, rationale: string, requestId: string, activePathId?: string | null, assumptionId?: string | null, history?: z.infer<typeof decisionHistorySchema>) {
  const profile = await requireProfile(); const projectKey = uuid.safeParse(projectId); const value = decisionSchema.safeParse(decision); const request = uuid.safeParse(requestId);
  const context = decisionHistorySchema.safeParse(history ?? {});
  if (!projectKey.success || !value.success || !request.success || !context.success || clean(rationale, 2000).length < 12) return { ok: false as const, error: "Choose a decision and explain it in at least 12 characters." };
  const supabase = await createClient(); if (!(await ownsProject(supabase, profile.id, projectKey.data))) return { ok: false as const, error: "Project not found." };
  const admin = createAdminClient();
  const { error } = await admin.from("project_decisions").insert({ user_id: profile.id, project_id: projectKey.data, validation_path_id: optionalUuid(activePathId), assumption_id: optionalUuid(assumptionId), decision_type: value.data, rationale: clean(rationale, 2000), previous_assumption: clean(context.data.previousAssumption,1000)||null, new_assumption: clean(context.data.newAssumption,1000)||null, evidence_summary: clean(context.data.evidenceSummary,1500)||null, outcome: clean(context.data.outcome,1500)||null, request_id: request.data });
  if (error && !/duplicate key/i.test(error.message)) return migrationError(error.message);
  await logBetaEvent({ userId: profile.id, projectId: projectKey.data, eventName: "validation_decision_recorded", source: "validation_workspace", metadata: { decision: value.data } });
  revalidatePath(`/projects/${projectKey.data}`); revalidatePath(`/projects/${projectKey.data}/timeline`); revalidatePath("/timeline"); return { ok: true as const };
}

export async function updateBiggestQuestion(projectId: string, assumptionId: string, statement: string, requestId: string) {
  const profile = await requireProfile();
  const projectKey = uuid.safeParse(projectId);
  const assumptionKey = uuid.safeParse(assumptionId);
  const requestKey = uuid.safeParse(requestId);
  const value = assumptionSchema.safeParse(statement);
  if (!projectKey.success || !assumptionKey.success || !requestKey.success || !value.success) {
    return { ok: false as const, error: value.success ? "That question could not be saved." : value.error.issues[0]?.message ?? "Write a clearer question." };
  }
  const supabase = await createClient();
  if (!(await ownsProject(supabase, profile.id, projectKey.data))) return { ok: false as const, error: "Project not found." };
  const { data: existing } = await supabase.from("project_assumptions").select("id").eq("id", assumptionKey.data).eq("project_id", projectKey.data).eq("user_id", profile.id).maybeSingle();
  if (!existing) return { ok: false as const, error: "The active question was not found. Refresh and try again." };
  const { error } = await createAdminClient().from("project_assumptions").update({ statement: clean(value.data, 1000), status: "untested", source: "founder", updated_at: new Date().toISOString() }).eq("id", assumptionKey.data).eq("project_id", projectKey.data).eq("user_id", profile.id);
  if (error) return migrationError(error.message);
  await logBetaEvent({ userId: profile.id, projectId: projectKey.data, eventName: "assumption_created", source: "biggest_question", metadata: { request_id: requestKey.data, edited: true } });
  revalidatePath(`/projects/${projectKey.data}`);
  return { ok: true as const };
}

async function ownsProject(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, projectId: string) { const { data } = await supabase.from("opportunity_projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle(); return Boolean(data); }
function clean(value: string, max: number) { return value.trim().replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, max); }
function optionalUuid(value?: string | null) { return value && uuid.safeParse(value).success ? value : null; }
function migrationError(message: string) { return { ok: false as const, error: /relation .* does not exist|schema cache|founder_validation_preferences|validation_paths|project_decisions/i.test(message) ? "Flexible validation is awaiting the latest Supabase migration." : "That change could not be saved. Please try again." }; }
