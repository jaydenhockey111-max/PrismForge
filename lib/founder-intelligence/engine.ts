import type {
  ActiveFounderPattern,
  FounderGuidancePreferences,
  FounderIntelligenceBuildInput,
  FounderIntelligenceProfile,
  PersonalizationContext,
  QuestIntensity,
} from "@/lib/founder-intelligence/types";
import { DEFAULT_GUIDANCE_PREFERENCES } from "@/lib/founder-intelligence/types";

export const FOUNDER_INTELLIGENCE_PROFILE_VERSION = 1;

export function buildFounderIntelligenceProfile(input: FounderIntelligenceBuildInput): FounderIntelligenceProfile {
  const now = (input.now ?? new Date()).toISOString();
  const preferences = normalizePreferences(input.preferences);
  const eligible = input.projectSnapshots.filter((item) => item.eligibilityStatus !== "ineligible");
  const evidenceProjects = eligible.filter((item) => item.externalEvidenceCount > 0);
  const completed = eligible.filter((item) => item.lifecycleOutcome === "completed");
  const launched = eligible.filter((item) => item.stageReached === "launched");
  const revenue = eligible.filter((item) => item.revenueEvidenceCount > 0);
  const experimentCount = eligible.reduce((sum, item) => sum + item.experimentCount, 0);
  const decisionCount = eligible.reduce((sum, item) => sum + item.meaningfulDecisionCount, 0);
  const repeatedPatterns = input.patterns.filter((item) => item.evidenceTier !== "early_indication");
  const confidence = eligible.length < 2 ? "insufficient_history" : repeatedPatterns.length > 0 ? "repeated_pattern" : "early_indication";
  const guidanceModeRecommendation = evidenceProjects.length >= 3 && decisionCount >= 2 ? "autonomous" : eligible.length < 2 ? "guided" : "balanced";
  const explanationRecommendation = evidenceProjects.length >= 3 && decisionCount >= 2 ? "brief" : eligible.length < 2 ? "detailed" : "standard";
  const questScopeRecommendation = recommendedQuestIntensity({ hoursPerWeek: input.latestDeclaredContext?.hoursPerWeek, experimentCount, evidenceProjectCount: evidenceProjects.length });
  const reasons = [
    eligible.length < 2 ? "There is not enough comparable project history for strong adaptation." : `${eligible.length} eligible projects contribute structured history.`,
    evidenceProjects.length ? `${evidenceProjects.length} project${evidenceProjects.length === 1 ? " has" : "s have"} recorded external evidence.` : "No project has recorded external evidence yet.",
    input.latestDeclaredContext?.hoursPerWeek ? `The latest recorded time limit is ${input.latestDeclaredContext.hoursPerWeek} hours per week.` : "A reliable weekly time limit is not available.",
  ];

  return {
    userId: input.userId,
    profileVersion: FOUNDER_INTELLIGENCE_PROFILE_VERSION,
    generatedAt: now,
    dataThrough: input.learningDataThrough ?? now,
    explicitPreferences: preferences,
    declaredContext: input.latestDeclaredContext ?? {},
    verifiedExperience: {
      eligibleProjectCount: eligible.length,
      completedProjectCount: completed.length,
      evidenceProducingProjectCount: evidenceProjects.length,
      completedQuestCount: input.completedQuestCount ?? 0,
      experimentCount,
      decisionCount,
      closureReflectionCount: input.closureReflectionCount ?? 0,
      launchedProjectCount: launched.length,
      revenueEvidenceProjectCount: revenue.length,
    },
    reliablePatterns: input.patterns.map(({ headline: _headline, explanation: _explanation, limitations: _limitations, ...reference }) => reference),
    dismissedPatternIds: unique(input.dismissedPatternIds ?? []),
    correctedPatternIds: unique(input.correctedPatternIds ?? []),
    adaptationState: { explanationRecommendation, questScopeRecommendation, guidanceModeRecommendation, confidence, reasons },
    dataQuality: {
      syntheticProjectsExcluded: input.syntheticProjectsExcluded ?? 0,
      deletedProjectsExcluded: input.deletedProjectsExcluded ?? 0,
      legacyLimitations: unique(input.legacyLimitations ?? []),
      missingSources: unique(input.missingSources ?? []),
    },
  };
}

export function buildPersonalizationContext(input: {
  profile: FounderIntelligenceProfile;
  patterns: ActiveFounderPattern[];
  currentProject: { projectType?: string | null; hoursPerWeek?: number | null; externalEvidenceCount?: number; status?: string | null };
  maxPatterns?: number;
}): PersonalizationContext {
  const { profile, currentProject } = input;
  const excluded: PersonalizationContext["excludedPatterns"] = [];
  if (!profile.explicitPreferences.historicalPersonalizationEnabled) {
    return {
      relevantPatterns: [],
      excludedPatterns: input.patterns.map((pattern) => ({ patternId: pattern.patternId, reason: "personalization_disabled" })),
      sources: [{ kind: "explicit_preference", reference: "historical_personalization_disabled" }, { kind: "current_project", reference: currentProject.status ?? "current" }],
      explanation: ["Lessons from previous projects are turned off. Current project evidence remains primary."],
    };
  }

  const relevant = input.patterns.filter((pattern) => {
    if (profile.dismissedPatternIds.includes(pattern.patternId)) { excluded.push({ patternId: pattern.patternId, reason: "dismissed" }); return false; }
    if (profile.correctedPatternIds.includes(pattern.patternId)) { excluded.push({ patternId: pattern.patternId, reason: "corrected" }); return false; }
    if (pattern.evidenceTier === "early_indication" || pattern.supportingProjectCount < 2) { excluded.push({ patternId: pattern.patternId, reason: "insufficient_evidence" }); return false; }
    const patternType = typeof pattern.dimensions.project_type === "string" ? pattern.dimensions.project_type : null;
    if (patternType && currentProject.projectType && normalize(patternType) !== normalize(currentProject.projectType)) { excluded.push({ patternId: pattern.patternId, reason: "not_comparable" }); return false; }
    if (pattern.dimensions.hours_band === "five_or_less" && (currentProject.hoursPerWeek ?? 99) > 5) { excluded.push({ patternId: pattern.patternId, reason: "not_comparable" }); return false; }
    if (pattern.category === "assumption" && (currentProject.externalEvidenceCount ?? 0) > 0) { excluded.push({ patternId: pattern.patternId, reason: "current_context_conflict" }); return false; }
    return true;
  }).sort(patternPriority).slice(0, input.maxPatterns ?? 2);

  const explanation = [
    `Current project status and evidence remain the primary source for this guidance.`,
    ...relevant.map((pattern) => pattern.headline),
  ];
  return {
    relevantPatterns: relevant,
    excludedPatterns: excluded,
    sources: [
      { kind: "explicit_preference", reference: profile.explicitPreferences.guidanceMode },
      { kind: "founder_profile", reference: `profile_v${profile.profileVersion}` },
      { kind: "current_project", reference: currentProject.status ?? "current" },
      ...relevant.map((pattern) => ({ kind: "cross_project_pattern" as const, reference: pattern.patternId })),
    ],
    explanation,
  };
}

export function compactFounderIntelligenceContext(profile: FounderIntelligenceProfile, context: PersonalizationContext) {
  return {
    guidanceMode: profile.explicitPreferences.guidanceMode,
    explanationDepth: profile.explicitPreferences.explanationDepth,
    questIntensity: profile.explicitPreferences.questIntensity,
    constraints: profile.declaredContext,
    relevantPatterns: context.relevantPatterns.slice(0, 2).map((pattern) => ({ category: pattern.category, observation: pattern.headline, evidenceTier: pattern.evidenceTier })),
    caveat: "Current project evidence overrides historical observations. These are correlations, not personality traits or predictions.",
  };
}

export function weeklyQuestLimit(intensity: QuestIntensity) {
  return intensity === "light" ? 2 : intensity === "ambitious" ? 4 : 3;
}

export function normalizePreferences(input?: Partial<FounderGuidancePreferences>): FounderGuidancePreferences {
  return {
    guidanceMode: isOneOf(input?.guidanceMode, ["guided", "balanced", "autonomous"]) ? input.guidanceMode : DEFAULT_GUIDANCE_PREFERENCES.guidanceMode,
    explanationDepth: isOneOf(input?.explanationDepth, ["brief", "standard", "detailed"]) ? input.explanationDepth : DEFAULT_GUIDANCE_PREFERENCES.explanationDepth,
    questIntensity: isOneOf(input?.questIntensity, ["light", "standard", "ambitious"]) ? input.questIntensity : DEFAULT_GUIDANCE_PREFERENCES.questIntensity,
    historicalPersonalizationEnabled: input?.historicalPersonalizationEnabled ?? true,
    showHistoricalReminders: input?.showHistoricalReminders ?? true,
    showPersonalizationReasons: input?.showPersonalizationReasons ?? true,
    preferenceVersion: Math.max(1, Number(input?.preferenceVersion ?? 1)),
  };
}

function recommendedQuestIntensity(input: { hoursPerWeek?: number; experimentCount: number; evidenceProjectCount: number }): QuestIntensity {
  if ((input.hoursPerWeek ?? 8) <= 5) return "light";
  if (input.evidenceProjectCount >= 3 && input.experimentCount >= 6) return "ambitious";
  return "standard";
}
function patternPriority(a: ActiveFounderPattern, b: ActiveFounderPattern) { return tier(b.evidenceTier) - tier(a.evidenceTier) || b.supportingProjectCount - a.supportingProjectCount; }
function tier(value: ActiveFounderPattern["evidenceTier"]) { return value === "strong_personal_pattern" ? 3 : value === "repeated_pattern" ? 2 : 1; }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function unique(values: string[]) { return Array.from(new Set(values)); }
function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T { return typeof value === "string" && choices.includes(value as T); }

