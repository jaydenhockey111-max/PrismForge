import "server-only";

import type { ProjectAssumption, ProjectDecision, ProjectOutput, ProjectValidationExperiment, ValidationPathRow } from "@/lib/database.types";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import type { ProjectLifecycleStatus } from "@/lib/database.types";
import { routeValidationPath, type FounderValidationPreference, type ValidationPathHistoryInput, type ValidationRoutingResult } from "@/lib/founder-os/validationReadiness";
import type { ProofSummary } from "@/lib/proof-board";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ValidationWorkspace = {
  route: ValidationRoutingResult;
  activePath: ValidationPathRow | null;
  preference: FounderValidationPreference | null;
  assumptions: ProjectAssumption[];
  decisions: ProjectDecision[];
  history: ValidationPathRow[];
  persistenceReady: boolean;
};

export async function getValidationWorkspace(input: {
  userId: string;
  projectId: string;
  report: OpportunityReport;
  status: ProjectStatus;
  lifecycleStatus?: ProjectLifecycleStatus;
  deletedAt?: string | null;
  proof: ProofSummary;
  experiments: ProjectValidationExperiment[];
  outputs: ProjectOutput[];
}): Promise<ValidationWorkspace> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const [preferenceResult, pathsResult, assumptionsResult, decisionsResult] = await Promise.all([
    supabase.from("founder_validation_preferences").select("*").eq("project_id", input.projectId).eq("user_id", input.userId).maybeSingle(),
    supabase.from("validation_paths").select("*").eq("project_id", input.projectId).eq("user_id", input.userId).order("created_at", { ascending: false }),
    supabase.from("project_assumptions").select("*").eq("project_id", input.projectId).eq("user_id", input.userId).order("updated_at", { ascending: false }),
    supabase.from("project_decisions").select("*").eq("project_id", input.projectId).eq("user_id", input.userId).order("created_at", { ascending: false }).limit(25),
  ]);

  const persistenceReady = !preferenceResult.error && !pathsResult.error && !assumptionsResult.error && !decisionsResult.error;
  const preference = (preferenceResult.data?.preference ?? null) as FounderValidationPreference | null;
  const history = (pathsResult.data ?? []) as ValidationPathRow[];
  const active = history.find((path) => path.status === "active") ?? null;
  const pathHistory = history.map((path) => ({ path_type: path.path_type, status: path.status, source: path.source, created_at: path.created_at })) as ValidationPathHistoryInput[];
  let route = routeValidationPath({ report: input.report, status: input.status, proof: input.proof, preference, experiments: input.experiments, outputs: input.outputs, pathHistory, forcedPath: active?.path_type as ValidationRoutingResult["pathType"] | undefined });
  let activePath = active;

  const lifecycleAllowsWork = (input.lifecycleStatus ?? "active") === "active" && !input.deletedAt;
  if (persistenceReady && lifecycleAllowsWork && (!activePath || route.complete)) {
    if (activePath && route.complete) {
      await admin.from("validation_paths").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", activePath.id).eq("user_id", input.userId);
      await appendPathEvent(admin, input.userId, input.projectId, activePath.id, "completed", activePath.path_type, route.nextPathHint, "Completion requirements were met by saved proof.");
      route = routeValidationPath({ report: input.report, status: input.status, proof: input.proof, preference, experiments: input.experiments, outputs: input.outputs, pathHistory: [...pathHistory, { path_type: route.pathType, status: "completed" }], forcedPath: route.nextPathHint });
    }
    const { data } = await admin.from("validation_paths").insert(pathInsert(input.userId, input.projectId, route, "system", route.complete ? "Advanced after completed evidence." : "Initial deterministic recommendation.")).select("*").maybeSingle();
    activePath = (data as ValidationPathRow | null) ?? null;
    if (activePath) await appendPathEvent(admin, input.userId, input.projectId, activePath.id, "activated", active?.path_type ?? null, route.pathType, active ? "Advanced after path completion." : "Initial path activated.");
  }

  let assumptions = (assumptionsResult.data ?? []) as ProjectAssumption[];
  if (persistenceReady && lifecycleAllowsWork) {
    const { data: savedAssumption } = await admin
      .from("project_assumptions")
      .upsert(
        { user_id: input.userId, project_id: input.projectId, assumption_key: route.targetAssumptionKey, statement: route.targetAssumption, source: "validation_router", updated_at: new Date().toISOString() },
        { onConflict: "user_id,project_id,assumption_key", ignoreDuplicates: true },
      )
      .select("*")
      .maybeSingle();
    if (savedAssumption && !assumptions.some((item) => item.id === savedAssumption.id)) {
      assumptions = [savedAssumption as ProjectAssumption, ...assumptions];
    }
  }

  return {
    route,
    activePath,
    preference,
    assumptions,
    decisions: (decisionsResult.data ?? []) as ProjectDecision[],
    history: activePath && !history.some((row) => row.id === activePath?.id) ? [activePath, ...history] : history,
    persistenceReady,
  };
}

export function pathInsert(userId: string, projectId: string, route: ValidationRoutingResult, source: "system" | "founder", reason: string) {
  return { user_id: userId, project_id: projectId, path_type: route.pathType, status: "active" as const, source, target_assumption_key: route.targetAssumptionKey, target_evidence_type: route.targetEvidenceType, rationale: route.rationale, success_condition: route.successCondition, completion_requirement: route.completionRequirement, next_path_hint: route.nextPathHint, selection_reason: reason, activated_at: new Date().toISOString(), metadata: { suggested_stage: route.suggestedStage, confidence: route.confidence } };
}

export async function appendPathEvent(supabase: Pick<Awaited<ReturnType<typeof createClient>>, "from">, userId: string, projectId: string, pathId: string | null, eventType: "recommended" | "activated" | "completed" | "replaced" | "paused" | "blocked" | "alternative_selected" | "avoidance_guard_triggered", previous: string | null, next: string | null, reason: string, requestId = crypto.randomUUID()) {
  await supabase.from("validation_path_events").insert({ user_id: userId, project_id: projectId, validation_path_id: pathId, event_type: eventType, previous_path_type: previous, next_path_type: next, reason, request_id: requestId, metadata: {} });
}
