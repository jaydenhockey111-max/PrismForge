"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logBetaEvent, type BetaEventName } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import { PROJECT_LIFECYCLE_ACTIONS, type ProjectLifecycleAction } from "@/lib/founder-os/projectLifecycle";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const actionSchema = z.enum(PROJECT_LIFECYCLE_ACTIONS);

export type LifecycleActionResult = { ok: boolean; error?: string; href?: string; changed?: boolean; lifecycleStatus?: string; deletedAt?: string | null; recoveryExpiresAt?: string | null };

export async function focusProject(projectId: string, requestId: string, source = "project_library"): Promise<LifecycleActionResult> {
  const profile = await requireProfile();
  const projectKey = uuid.safeParse(projectId); const requestKey = uuid.safeParse(requestId);
  if (!projectKey.success || !requestKey.success) return { ok: false, error: "That project selection was invalid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_current_project_focus", { p_project_id: projectKey.data, p_request_id: requestKey.data, p_source: source.slice(0, 80) });
  if (error) return { ok: false, error: lifecycleError(error.message) };
  const result = data?.[0];
  await logBetaEvent({ userId: profile.id, projectId: projectKey.data, eventName: "project_focus_changed", source, metadata: { changed: Boolean(result?.changed), previous_project_id: result?.previous_project_id ?? null } });
  revalidateProjectSurfaces(projectKey.data);
  return { ok: true, changed: Boolean(result?.changed), href: `/projects/${projectKey.data}?section=today` };
}

export async function resumeProject(projectId: string, requestId: string, expectedVersion: number, source = "project_library"): Promise<LifecycleActionResult> {
  const profile = await requireProfile(); const projectKey = uuid.safeParse(projectId); const requestKey = uuid.safeParse(requestId);
  if (!projectKey.success || !requestKey.success || !Number.isInteger(expectedVersion) || expectedVersion < 0) return { ok: false, error: "That resume request was invalid." };
  const supabase = await createClient();
  const { data: project } = await supabase.from("opportunity_projects").select("id,lifecycle_status,deleted_at").eq("id", projectKey.data).eq("user_id", profile.id).maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };
  if (project.deleted_at) return { ok: false, error: "Restore this project from recovery before resuming it." };
  if (project.lifecycle_status === "active") {
    const result = await focusProject(projectKey.data, requestKey.data, source);
    if (result.ok) await logBetaEvent({ userId: profile.id, projectId: projectKey.data, eventName: "resume_project_clicked", source, metadata: { previous_lifecycle_status: "active" } });
    return result;
  }
  if (project.lifecycle_status !== "paused") return { ok: false, error: "Restore this project to active work before resuming it." };
  const result = await transitionProjectLifecycle({ projectId: projectKey.data, action: "resume", reason: "Resumed from the project library.", requestId: requestKey.data, expectedVersion, setFocus: true, source });
  if (result.ok) await logBetaEvent({ userId: profile.id, projectId: projectKey.data, eventName: "resume_project_clicked", source, metadata: { previous_lifecycle_status: "paused" } });
  return result.ok ? { ...result, href: `/projects/${projectKey.data}?section=today` } : result;
}

export async function transitionProjectLifecycle(input: { projectId: string; action: ProjectLifecycleAction; reason?: string; requestId: string; expectedVersion: number; setFocus?: boolean; confirmation?: string; source?: string }): Promise<LifecycleActionResult> {
  const profile = await requireProfile();
  const projectKey = uuid.safeParse(input.projectId); const requestKey = uuid.safeParse(input.requestId); const action = actionSchema.safeParse(input.action);
  if (!projectKey.success || !requestKey.success || !action.success || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) return { ok: false, error: "That lifecycle request was invalid." };
  const reason = String(input.reason ?? "").trim().replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, 500);
  const supabase = await createClient();
  if (action.data === "permanent_delete") await logBetaEvent({ userId: profile.id, projectId: projectKey.data, eventName: "project_permanent_delete_requested", source: input.source ?? "project_lifecycle", metadata: { request_id: requestKey.data } });
  const { data, error } = await supabase.rpc("transition_project_lifecycle", { p_project_id: projectKey.data, p_action: action.data, p_reason: reason, p_request_id: requestKey.data, p_expected_version: input.expectedVersion, p_set_focus: input.setFocus ?? true, p_confirmation: input.confirmation?.slice(0, 160) ?? null });
  if (error) {
    await logBetaEvent({ userId: profile.id, projectId: projectKey.data, eventName: action.data.includes("delete") ? "project_delete_failed" : "project_lifecycle_conflict", source: input.source ?? "project_lifecycle", metadata: { action: action.data, error_category: classifyError(error.message) } });
    return { ok: false, error: lifecycleError(error.message) };
  }
  const result = data?.[0];
  const eventName = analyticsEvent(action.data);
  await logBetaEvent({ userId: profile.id, projectId: action.data === "permanent_delete" ? null : projectKey.data, eventName, source: input.source ?? "project_lifecycle", metadata: { action: action.data, changed: Boolean(result?.changed), lifecycle_status: result?.lifecycle_status ?? null } });
  revalidateProjectSurfaces(projectKey.data);
  return { ok: true, changed: Boolean(result?.changed), lifecycleStatus: result?.lifecycle_status, deletedAt: result?.deleted_at ?? null, recoveryExpiresAt: result?.recovery_expires_at ?? null, href: action.data === "permanent_delete" ? "/projects?message=Project%20permanently%20deleted" : "/projects" };
}

function analyticsEvent(action: ProjectLifecycleAction): BetaEventName {
  return ({ pause: "project_paused", resume: "project_resumed", complete: "project_completed", archive: "project_archived", abandon: "project_abandoned", restore: "project_restored", soft_delete: "project_soft_deleted", permanent_delete: "project_permanently_deleted" } satisfies Record<ProjectLifecycleAction, BetaEventName>)[action];
}
function classifyError(message: string) { if (/another tab|version/i.test(message)) return "stale_version"; if (/not found|available|ownership/i.test(message)) return "ownership_or_missing"; if (/reflection/i.test(message)) return "reflection_required"; if (/confirm/i.test(message)) return "confirmation"; return "database"; }
function lifecycleError(message: string) { if (/another tab|version/i.test(message)) return "This project changed in another tab. Refresh and try again."; if (/reflection/i.test(message)) return "Save the closure reflection before completing or stopping this project."; if (/recovery window/i.test(message)) return "The recovery window has expired. Contact support before permanent removal."; if (/confirmation/i.test(message)) return "The project title did not match."; if (/not found|available for focus/i.test(message)) return "Project not found."; if (/latest Supabase migration|schema cache|function .* does not exist/i.test(message)) return "Project lifecycle is awaiting the latest Supabase migration."; return message.length <= 180 ? message : "The lifecycle change could not be saved."; }
function revalidateProjectSurfaces(projectId: string) { revalidatePath("/", "layout"); revalidatePath("/dashboard"); revalidatePath("/projects"); revalidatePath("/progress"); revalidatePath("/timeline"); revalidatePath(`/projects/${projectId}`); revalidatePath(`/projects/${projectId}/timeline`); }
