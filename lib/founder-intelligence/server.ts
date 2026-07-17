import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildFounderIntelligenceProfile,
  buildPersonalizationContext,
  compactFounderIntelligenceContext,
  FOUNDER_INTELLIGENCE_PROFILE_VERSION,
  normalizePreferences,
} from "@/lib/founder-intelligence/engine";
import type { ActiveFounderPattern, FounderGuidancePreferences, FounderIntelligenceProfile } from "@/lib/founder-intelligence/types";
import { DEFAULT_GUIDANCE_PREFERENCES } from "@/lib/founder-intelligence/types";

const PROFILE_CACHE_MS = 15 * 60 * 1000;
const CALCULATION_LEASE_MS = 2 * 60 * 1000;

export type FounderIntelligenceResult = {
  profile: FounderIntelligenceProfile;
  patterns: ActiveFounderPattern[];
  source: "cache" | "recalculated" | "fallback";
};

export async function getFounderIntelligence(userId: string): Promise<FounderIntelligenceResult> {
  const admin = createAdminClient() as any;
  const [preferences, cachedRow, patterns] = await Promise.all([
    loadPreferences(admin, userId),
    admin.from("founder_intelligence_profiles").select("*").eq("user_id", userId).maybeSingle(),
    loadActivePatterns(admin, userId),
  ]);
  const cached = cachedRow.data;
  if (isUsableCache(cached, preferences.preferenceVersion)) {
    const parsed = parseProfile(cached.profile_json, userId, preferences);
    if (parsed) return { profile: parsed, patterns, source: "cache" };
  }

  const leaseExpired = !cached?.calculation_started_at || Date.now() - new Date(cached.calculation_started_at).getTime() > CALCULATION_LEASE_MS;
  if (cached?.status === "calculating" && !leaseExpired) {
    const parsed = parseProfile(cached.profile_json, userId, preferences);
    if (parsed) return { profile: parsed, patterns, source: "cache" };
  }

  const requestId = crypto.randomUUID();
  await admin.from("founder_intelligence_profiles").upsert({
    user_id: userId,
    status: "calculating",
    calculation_started_at: new Date().toISOString(),
    calculation_request_id: requestId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  try {
    const [snapshotsResult, learningStateResult, questCountResult, reflectionCountResult, syntheticCountResult, deletedCountResult, inactivePatternsResult] = await Promise.all([
      admin.from("founder_project_learning_snapshots").select("project_id,eligibility_status,lifecycle_outcome,stage_reached,hours_per_week,budget_band,risk_tolerance,technical_ability,experiment_count,meaningful_decision_count,customer_conversation_count,waitlist_signal_count,payment_intent_count,revenue_evidence_count,limitations,source_updated_at").eq("user_id", userId).order("source_updated_at", { ascending: false }).limit(250),
      admin.from("founder_learning_state").select("calculation_version,data_through").eq("user_id", userId).maybeSingle(),
      admin.from("user_daily_quests").select("*", { count: "exact", head: true }).eq("user_id", userId).not("completed_at", "is", null),
      admin.from("project_closure_reflections").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("opportunity_projects").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_synthetic", true),
      admin.from("opportunity_projects").select("*", { count: "exact", head: true }).eq("user_id", userId).not("deleted_at", "is", null),
      admin.from("founder_pattern_insights").select("id,status").eq("user_id", userId).in("status", ["dismissed", "corrected"]).limit(250),
    ]);
    if (snapshotsResult.error) throw new Error("snapshot_load_failed");
    const snapshots = (snapshotsResult.data ?? []).map((row: any) => ({
      projectId: row.project_id,
      eligibilityStatus: row.eligibility_status,
      lifecycleOutcome: row.lifecycle_outcome,
      stageReached: row.stage_reached,
      experimentCount: Number(row.experiment_count ?? 0),
      meaningfulDecisionCount: Number(row.meaningful_decision_count ?? 0),
      externalEvidenceCount: Number(row.customer_conversation_count ?? 0) + Number(row.waitlist_signal_count ?? 0) + Number(row.payment_intent_count ?? 0) + Number(row.revenue_evidence_count ?? 0),
      revenueEvidenceCount: Number(row.revenue_evidence_count ?? 0),
    }));
    const latest = snapshotsResult.data?.[0];
    const inactive = inactivePatternsResult.data ?? [];
    const legacyLimitations = Array.from(new Set((snapshotsResult.data ?? []).flatMap((row: any) => Array.isArray(row.limitations) ? row.limitations : []))).slice(0, 8) as string[];
    const missingSources = [
      snapshots.length === 0 ? "No eligible project snapshots are available yet." : null,
      Number(reflectionCountResult.count ?? 0) === 0 ? "No closure reflections are available." : null,
      snapshots.reduce((sum: number, row: any) => sum + row.meaningfulDecisionCount, 0) === 0 ? "No structured decisions are available." : null,
    ].filter((item): item is string => Boolean(item));
    const profile = buildFounderIntelligenceProfile({
      userId,
      preferences,
      latestDeclaredContext: latest ? {
        hoursPerWeek: numberOrUndefined(latest.hours_per_week),
        budgetBand: textOrUndefined(latest.budget_band),
        technicalAbility: textOrUndefined(latest.technical_ability),
        riskTolerance: numberOrUndefined(latest.risk_tolerance),
      } : {},
      projectSnapshots: snapshots,
      patterns,
      dismissedPatternIds: inactive.filter((row: any) => row.status === "dismissed").map((row: any) => row.id),
      correctedPatternIds: inactive.filter((row: any) => row.status === "corrected").map((row: any) => row.id),
      completedQuestCount: Number(questCountResult.count ?? 0),
      closureReflectionCount: Number(reflectionCountResult.count ?? 0),
      syntheticProjectsExcluded: Number(syntheticCountResult.count ?? 0),
      deletedProjectsExcluded: Number(deletedCountResult.count ?? 0),
      learningDataThrough: learningStateResult.data?.data_through,
      legacyLimitations,
      missingSources,
    });
    await admin.from("founder_intelligence_profiles").update({
      profile_version: FOUNDER_INTELLIGENCE_PROFILE_VERSION,
      status: "ready",
      profile_json: profile,
      learning_version: Number(learningStateResult.data?.calculation_version ?? 0),
      generated_at: profile.generatedAt,
      data_through: profile.dataThrough,
      calculation_started_at: null,
      last_error_category: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("calculation_request_id", requestId);
    return { profile, patterns, source: "recalculated" };
  } catch {
    await admin.from("founder_intelligence_profiles").update({ status: "error", calculation_started_at: null, last_error_category: "profile_calculation_failed", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("calculation_request_id", requestId);
    return { profile: emptyProfile(userId, preferences), patterns, source: "fallback" };
  }
}

export async function getProjectPersonalization(input: {
  userId: string;
  projectType?: string | null;
  hoursPerWeek?: number | null;
  externalEvidenceCount?: number;
  status?: string | null;
}) {
  const intelligence = await getFounderIntelligence(input.userId);
  const context = buildPersonalizationContext({ profile: intelligence.profile, patterns: intelligence.patterns, currentProject: input, maxPatterns: 2 });
  return { ...intelligence, context, compactAiContext: compactFounderIntelligenceContext(intelligence.profile, context) };
}

async function loadPreferences(admin: any, userId: string): Promise<FounderGuidancePreferences> {
  const { data } = await admin.from("founder_guidance_preferences").select("*").eq("user_id", userId).maybeSingle();
  if (!data) {
    await admin.from("founder_guidance_preferences").upsert({ user_id: userId }, { onConflict: "user_id" });
    return DEFAULT_GUIDANCE_PREFERENCES;
  }
  return normalizePreferences({
    guidanceMode: data.guidance_mode,
    explanationDepth: data.explanation_depth,
    questIntensity: data.quest_intensity,
    historicalPersonalizationEnabled: data.historical_personalization_enabled,
    showHistoricalReminders: data.show_historical_reminders,
    showPersonalizationReasons: data.show_personalization_reasons,
    preferenceVersion: data.preference_version,
  });
}

async function loadActivePatterns(admin: any, userId: string): Promise<ActiveFounderPattern[]> {
  const { data } = await admin.from("founder_pattern_insights").select("id,category,headline,explanation,evidence_tier,supporting_project_count,contradicting_project_count,dimensions,limitations").eq("user_id", userId).eq("status", "active").order("supporting_project_count", { ascending: false }).limit(30);
  return (data ?? []).map((row: any) => ({ patternId: row.id, category: row.category, headline: row.headline, explanation: row.explanation, evidenceTier: row.evidence_tier, supportingProjectCount: row.supporting_project_count, contradictingProjectCount: row.contradicting_project_count, dimensions: isRecord(row.dimensions) ? row.dimensions : {}, limitations: Array.isArray(row.limitations) ? row.limitations : [] }));
}

function isUsableCache(row: any, preferenceVersion: number) {
  if (!row || row.status !== "ready" || Number(row.profile_version) !== FOUNDER_INTELLIGENCE_PROFILE_VERSION || !row.generated_at) return false;
  const profile = row.profile_json as any;
  return Date.now() - new Date(row.generated_at).getTime() < PROFILE_CACHE_MS && Number(profile?.explicitPreferences?.preferenceVersion ?? 0) === preferenceVersion && (!row.dirty_at || new Date(row.dirty_at) <= new Date(row.generated_at));
}
function parseProfile(value: unknown, userId: string, preferences: FounderGuidancePreferences): FounderIntelligenceProfile | null {
  if (!isRecord(value) || value.userId !== userId || !isRecord(value.verifiedExperience) || !isRecord(value.adaptationState)) return null;
  return { ...(value as unknown as FounderIntelligenceProfile), explicitPreferences: preferences };
}
function emptyProfile(userId: string, preferences: FounderGuidancePreferences) {
  return buildFounderIntelligenceProfile({ userId, preferences, projectSnapshots: [], patterns: [], missingSources: ["Personalization history is temporarily unavailable."] });
}
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function numberOrUndefined(value: unknown) { if (value === null || value === undefined || value === "") return undefined; const number = Number(value); return Number.isFinite(number) ? number : undefined; }
function textOrUndefined(value: unknown) { return typeof value === "string" && value.length ? value : undefined; }
