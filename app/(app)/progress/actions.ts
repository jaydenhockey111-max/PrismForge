"use server";

import { z } from "zod";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import type { BusinessType, OpportunityReport } from "@/lib/founder-os/types";
import { awardFounderProgress } from "@/lib/progress/server";
import { buildFounderQuestPlan } from "@/lib/progress/questPolicy";
import { summarizeProof } from "@/lib/proof-board";
import { createClient } from "@/lib/supabase/server";
import { getValidationWorkspace } from "@/lib/founder-os/validationWorkspace.server";

const uuidSchema = z.string().uuid();
const detailSchema = z.string().trim().max(500).default("");

export async function completeFounderQuest(input: { projectId: string; questId: string; detail?: string }) {
  const profile = await requireProfile();
  const projectId = uuidSchema.parse(input.projectId);
  const questId = z.string().min(12).max(300).parse(input.questId);
  const detail = detailSchema.parse(input.detail ?? "");
  const supabase = await createClient();
  const [{ data: project, error }, { data: experiments }, { data: outputs }] = await Promise.all([
    supabase.from("opportunity_projects").select("*").eq("id", projectId).eq("user_id", profile.id).maybeSingle(),
    supabase.from("project_validation_experiments").select("*").eq("project_id", projectId).eq("user_id", profile.id),
    supabase.from("project_outputs").select("*").eq("project_id", projectId).eq("user_id", profile.id),
  ]);
  if (error || !project) throw new Error("Project not found.");
  const report = isOpportunityReport(project.report_json) ? project.report_json : null;
  if (!report) throw new Error("This project does not have enough structured context for quest verification.");

  const proof = summarizeProof(experiments ?? []);
  const validationWorkspace = await getValidationWorkspace({ userId: profile.id, projectId, report, status: project.status, proof, experiments: experiments ?? [], outputs: outputs ?? [] });
  const plan = buildFounderQuestPlan({
    userId: profile.id,
    project: { ...project, business_type: project.business_type as BusinessType, report_json: project.report_json },
    report,
    proof,
    experiments: experiments ?? [], outputs: outputs ?? [],
    validationPath: validationWorkspace.route,
  });
  const quest = [plan.dailyQuest, ...plan.weeklyQuests].find((item) => item?.id === questId);
  if (!quest) throw new Error("This quest is no longer active. Refresh to see the current quest.");

  const verifiedByState = quest.done && (quest.verificationMethod === "system_state" || quest.verificationMethod === "evidence_record" || quest.verificationMethod === "hybrid");
  const manualAllowed = quest.verificationMethod === "manual_with_detail" || quest.verificationMethod === "hybrid";
  if (!verifiedByState && (!manualAllowed || detail.length < 20)) {
    await logBetaEvent({ userId: profile.id, projectId, eventName: "xp_event_rejected", source: "quest", metadata: { reason: "completion_not_verified", cadence: quest.cadence } });
    throw new Error(quest.verificationMethod === "evidence_record" ? "Update Proof Board evidence first, then refresh." : "Add at least one sentence explaining what you completed and learned.");
  }

  const verificationLevel = verifiedByState
    ? quest.verificationMethod === "system_state" ? "system_verified" as const : "evidence_supported" as const
    : "manual_detailed" as const;
  const result = await awardFounderProgress({
    userId: profile.id, projectId, eventType: quest.cadence === "daily" ? "daily_quest_completed" : "weekly_quest_completed",
    verificationLevel, sourceType: "quest", sourceId: quest.id,
    idempotencyKey: `quest:${quest.id}:completion`,
    reason: verifiedByState ? `Completed ${quest.cadence} quest: ${quest.title}` : `Manually documented ${quest.cadence} quest completion with detail.`,
    metadata: { cadence: quest.cadence, category: quest.category, verification_method: quest.verificationMethod },
  });
  if (quest.source === "next_best_action") {
    await awardFounderProgress({
      userId: profile.id, projectId, eventType: "next_best_action_completed", verificationLevel,
      sourceType: "quest", sourceId: quest.id, idempotencyKey: `next-action:${quest.id}:completion`,
      reason: "Completed a quest directly linked to the current Next Best Action.",
      metadata: { cadence: quest.cadence, category: quest.category },
    });
  }
  await logBetaEvent({
    userId: profile.id, projectId,
    eventName: result.inserted ? (verifiedByState ? "quest_completion_verified" : "quest_completed_manually") : "duplicate_quest_completion_prevented",
    source: "quest", metadata: { quest_id: quest.id, awarded_xp: result.awardedXp, verification_level: verificationLevel },
  });
  // The XP trigger records only verified, meaningful completions in Founder Timeline.
  return { ok: true as const, duplicate: !result.inserted, awardedXp: result.awardedXp, verificationLevel, totalXp: result.totalXp };
}

function isOpportunityReport(value: unknown): value is OpportunityReport {
  return Boolean(value && typeof value === "object" && "summary" in value && "mvpPlan" in value && "executionRoadmap" in value);
}
