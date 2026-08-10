import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { requireProfile } from "@/lib/auth";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { buildNextMove } from "@/lib/founder-os/nextMove";
import { routeValidationPath } from "@/lib/founder-os/validationReadiness";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import { summarizeProof } from "@/lib/proof-board";
import { buildMarketResearchContext, isMarketResearchEligible, MARKET_RESEARCH_EXECUTION_TYPE } from "@/lib/execution/marketResearch";
import { existingSecondaryResearch, createQueuedMarketResearchExecution, attachMarketResearchWorkflow } from "@/lib/execution/marketResearchRepository";
import { preflightExecution, finalizeExecution } from "@/lib/execution/repository";
import { createClient } from "@/lib/supabase/server";
import { runMarketResearchWorkflow } from "@/workflows/market-research";

const inputSchema = z.object({ projectId: z.string().uuid(), requestId: z.string().uuid() });

export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid research request." }, { status: 400 });
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: project }, { data: experiments }, { data: preference }, { data: assumptions }, { data: decisions }, { data: paths }] = await Promise.all([
    supabase.from("opportunity_projects").select("id,status,report_json,lifecycle_status,deleted_at").eq("id", input.data.projectId).eq("user_id", profile.id).maybeSingle(),
    supabase.from("project_validation_experiments").select("*").eq("project_id", input.data.projectId).eq("user_id", profile.id),
    supabase.from("founder_validation_preferences").select("preference").eq("project_id", input.data.projectId).eq("user_id", profile.id).maybeSingle(),
    supabase.from("project_assumptions").select("id,assumption_key,status,statement").eq("project_id", input.data.projectId).eq("user_id", profile.id),
    supabase.from("project_decisions").select("decision_type,outcome,rationale,evidence_summary").eq("project_id", input.data.projectId).eq("user_id", profile.id),
    supabase.from("validation_paths").select("id,path_type,status,created_at").eq("project_id", input.data.projectId).eq("user_id", profile.id),
  ]);
  if (!project || project.deleted_at || project.lifecycle_status !== "active") return NextResponse.json({ error: "Project not available for research." }, { status: 404 });

  const proof = summarizeProof(experiments ?? []);
  const route = routeValidationPath({
    report: project.report_json as OpportunityReport,
    status: project.status as ProjectStatus,
    proof,
    preference: preference?.preference as never,
    experiments: experiments ?? [],
    assumptions: assumptions ?? [],
    decisions: decisions ?? [],
    pathHistory: (paths ?? []).map((path) => ({ path_type: path.path_type as never, status: path.status as never, created_at: path.created_at })),
  });
  const nextMove = buildNextMove({ projectId: project.id, report: project.report_json as OpportunityReport, status: project.status as ProjectStatus, proof, route, experiments: experiments ?? [] });
  if (!isMarketResearchEligible({ routeKey: route.pathType, executionMode: nextMove.support.executionMode, report: project.report_json as OpportunityReport })) {
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "execution_preflight_rejected", source: "market_research", metadata: { reason: "NEXT_MOVE_NOT_ELIGIBLE" } });
    return NextResponse.json({ error: "Market research is not the current eligible Next Move." }, { status: 409 });
  }

  const preflight = await preflightExecution({ userId: profile.id, projectId: project.id, executionType: MARKET_RESEARCH_EXECUTION_TYPE, estimatedCostUsd: 0.25, requestId: input.data.requestId });
  if (!preflight.allowed) {
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "execution_preflight_rejected", source: "market_research", metadata: { reason: preflight.reason } });
    return NextResponse.json({ error: readablePreflightFailure(preflight.reason) }, { status: preflight.reason === "PLAN_TIER_DENIED" ? 403 : 409 });
  }

  try {
    const [priorResearch, activePath, targetAssumption] = await Promise.all([
      existingSecondaryResearch(project.id, profile.id),
      supabase.from("validation_paths").select("id").eq("project_id", project.id).eq("user_id", profile.id).eq("path_type", route.pathType).in("status", ["recommended", "active"]).limit(1).maybeSingle(),
      supabase.from("project_assumptions").select("id").eq("project_id", project.id).eq("user_id", profile.id).eq("assumption_key", route.targetAssumptionKey).maybeSingle(),
    ]);
    const queued = await createQueuedMarketResearchExecution({
      userId: profile.id,
      projectId: project.id,
      requestId: input.data.requestId,
      reservationId: preflight.reservationId,
      routeKey: route.pathType,
      targetAssumptionKey: route.targetAssumptionKey,
      validationPathId: activePath.data?.id ?? null,
      targetAssumptionId: targetAssumption.data?.id ?? null,
    });
    if (queued.duplicate) return NextResponse.json({ executionId: queued.execution.id, status: queued.execution.status, duplicate: true });
    const context = buildMarketResearchContext({ report: project.report_json as OpportunityReport, nextMove, priorResearch });
    const workflowRun = await start(runMarketResearchWorkflow, [{ executionId: queued.execution.id, context }]);
    await attachMarketResearchWorkflow(queued.execution.id, workflowRun.runId);
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "do_it_for_me_started", source: "market_research", metadata: { execution_type: MARKET_RESEARCH_EXECUTION_TYPE } });
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "execution_started", source: "market_research", metadata: { execution_type: MARKET_RESEARCH_EXECUTION_TYPE } });
    return NextResponse.json({ executionId: queued.execution.id, status: "queued", duplicate: false }, { status: 202 });
  } catch {
    await finalizeExecution({ reservationId: preflight.reservationId, status: "released", terminationReason: "INTERNAL_ERROR" });
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "execution_failed", source: "market_research", metadata: { reason: "WORKFLOW_START_FAILED" } });
    return NextResponse.json({ error: "Research could not be started. No usage was charged." }, { status: 503 });
  }
}

function readablePreflightFailure(reason: string) {
  if (reason === "PLAN_TIER_DENIED" || reason === "MONTHLY_LIMIT") return "Your plan’s autonomous research allowance is unavailable.";
  if (reason === "AUTONOMOUS_EXECUTION_DISABLED") return "Autonomous research is not currently available.";
  return "Research could not pass the server-side execution checks.";
}
