import { NextResponse } from "next/server";
import { z } from "zod";
import { createValidationExperiment } from "@/app/(app)/projects/proof-actions";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import { marketResearchResultSchema } from "@/lib/execution/marketResearch";
import { ownedMarketResearchExecution } from "@/lib/execution/marketResearchRepository";

const inputSchema = z.object({ executionId: z.string().uuid() });

export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid research handoff." }, { status: 400 });
  const profile = await requireProfile();
  const execution = await ownedMarketResearchExecution(profile.id, input.data.executionId);
  if (!execution || execution.status !== "completed" || !execution.result_json) return NextResponse.json({ error: "Completed research was not found." }, { status: 404 });
  const research = marketResearchResultSchema.safeParse(execution.result_json);
  if (!research.success) return NextResponse.json({ error: "The research result cannot be handed off safely." }, { status: 409 });
  const created = await createValidationExperiment(execution.project_id, {
    title: "AI-assisted secondary research finding",
    goal: "Preserve a cited public research finding that should make the next external test more specific.",
    status: "completed",
    channel: "other",
    hypothesis: execution.target_assumption_key,
    target_audience: "Public market and competitor sources; not direct customer validation.",
    task_description: research.data.conciseAnswer,
    people_contacted: 0,
    replies: 0,
    pain_confirmed: 0,
    interested_users: 0,
    waitlist_signups: 0,
    payment_intent: 0,
    preorders_or_revenue_cents: 0,
    key_quotes: "",
    learnings: `${research.data.conciseAnswer}\n\nFounder interpretation: ${research.data.recommendedFounderInterpretation}`,
    next_action: research.data.implicationsForNextMove[0] ?? "Use this context to make the next external test more specific.",
    confidence_score: 0,
    validation_path_id: execution.validation_path_id,
    target_assumption_id: execution.target_assumption_id,
    evidence_type: "research_pattern",
    decision_type: null,
    request_id: crypto.randomUUID(),
    evidence_provenance: "ai_secondary_research",
    source_urls: research.data.sources.map((source) => source.url),
  });
  await logBetaEvent({ userId: profile.id, projectId: execution.project_id, eventName: "research_finding_handoff_started", source: "market_research", metadata: { execution_type: execution.execution_type } });
  return NextResponse.json({ experimentId: created.id }, { status: 201 });
}
