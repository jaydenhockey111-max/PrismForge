import "server-only";
import type { Json, MarketResearchExecution, ProjectValidationExperiment } from "@/lib/database.types";
import type { MarketResearchResult } from "@/lib/execution/marketResearch";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createQueuedMarketResearchExecution(input: {
  userId: string;
  projectId: string;
  requestId: string;
  reservationId: string;
  routeKey: string;
  targetAssumptionKey: string;
  validationPathId: string | null;
  targetAssumptionId: string | null;
}) {
  const admin = createAdminClient();
  const payload = {
    user_id: input.userId,
    project_id: input.projectId,
    request_id: input.requestId,
    reservation_id: input.reservationId,
    route_key: input.routeKey,
    target_assumption_key: input.targetAssumptionKey,
    validation_path_id: input.validationPathId,
    target_assumption_id: input.targetAssumptionId,
  };
  const { data, error } = await admin.from("market_research_executions").insert(payload).select("*").maybeSingle();
  if (!error && data) return { execution: data as MarketResearchExecution, duplicate: false };
  const { data: existing } = await admin.from("market_research_executions").select("*").eq("user_id", input.userId).eq("request_id", input.requestId).maybeSingle();
  if (existing) return { execution: existing as MarketResearchExecution, duplicate: true };
  throw new Error(error?.message ?? "Could not queue market research.");
}

export async function attachMarketResearchWorkflow(executionId: string, workflowRunId: string) {
  const admin = createAdminClient();
  await admin.from("market_research_executions").update({ workflow_run_id: workflowRunId, updated_at: new Date().toISOString() }).eq("id", executionId);
}

export async function beginMarketResearchExecution(executionId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("market_research_executions").select("*").eq("id", executionId).maybeSingle();
  if (!data || data.status !== "queued") return null;
  const { data: updated } = await admin.from("market_research_executions")
    .update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", executionId).eq("status", "queued").select("*").maybeSingle();
  return updated as MarketResearchExecution | null;
}

export async function getMarketResearchExecution(executionId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("market_research_executions").select("*").eq("id", executionId).maybeSingle();
  return data as MarketResearchExecution | null;
}

export async function completeMarketResearchExecution(executionId: string, result: MarketResearchResult) {
  const admin = createAdminClient();
  await admin.from("market_research_executions").update({ status: "completed", result_json: result as unknown as Json, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", executionId);
}

export async function failMarketResearchExecution(executionId: string, reason: string) {
  const admin = createAdminClient();
  await admin.from("market_research_executions").update({ status: "failed", failure_reason: reason.slice(0, 240), completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", executionId).in("status", ["queued", "running"]);
}

export async function latestMarketResearchExecution(userId: string, projectId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("market_research_executions").select("*").eq("user_id", userId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return null; // Existing projects remain usable until the additive migration is applied.
  return data as MarketResearchExecution | null;
}

export async function ownedMarketResearchExecution(userId: string, executionId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("market_research_executions").select("*").eq("id", executionId).eq("user_id", userId).maybeSingle();
  return data as MarketResearchExecution | null;
}

export async function existingSecondaryResearch(projectId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("project_validation_experiments")
    .select("learnings")
    .eq("project_id", projectId).eq("user_id", userId).eq("evidence_provenance", "ai_secondary_research")
    .order("created_at", { ascending: false }).limit(4);
  return (data ?? []).map((item) => (item as Pick<ProjectValidationExperiment, "learnings">).learnings).filter((value): value is string => Boolean(value));
}
