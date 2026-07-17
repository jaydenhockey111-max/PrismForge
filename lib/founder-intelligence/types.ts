export type GuidanceMode = "guided" | "balanced" | "autonomous";
export type ExplanationDepth = "brief" | "standard" | "detailed";
export type QuestIntensity = "light" | "standard" | "ambitious";
export type AdaptationConfidence = "insufficient_history" | "early_indication" | "repeated_pattern";

export type FounderGuidancePreferences = {
  guidanceMode: GuidanceMode;
  explanationDepth: ExplanationDepth;
  questIntensity: QuestIntensity;
  historicalPersonalizationEnabled: boolean;
  showHistoricalReminders: boolean;
  showPersonalizationReasons: boolean;
  preferenceVersion: number;
};

export const DEFAULT_GUIDANCE_PREFERENCES: FounderGuidancePreferences = {
  guidanceMode: "balanced",
  explanationDepth: "standard",
  questIntensity: "standard",
  historicalPersonalizationEnabled: true,
  showHistoricalReminders: true,
  showPersonalizationReasons: true,
  preferenceVersion: 1,
};

export type FounderPatternReference = {
  patternId: string;
  category: string;
  evidenceTier: "early_indication" | "repeated_pattern" | "strong_personal_pattern";
  supportingProjectCount: number;
  contradictingProjectCount: number;
  dimensions: Record<string, string | number | boolean | null>;
};

export type FounderIntelligenceProfile = {
  userId: string;
  profileVersion: number;
  generatedAt: string;
  dataThrough: string;
  explicitPreferences: FounderGuidancePreferences;
  declaredContext: {
    hoursPerWeek?: number;
    budgetBand?: string;
    technicalAbility?: string;
    riskTolerance?: number;
  };
  verifiedExperience: {
    eligibleProjectCount: number;
    completedProjectCount: number;
    evidenceProducingProjectCount: number;
    completedQuestCount: number;
    experimentCount: number;
    decisionCount: number;
    closureReflectionCount: number;
    launchedProjectCount: number;
    revenueEvidenceProjectCount: number;
  };
  reliablePatterns: FounderPatternReference[];
  dismissedPatternIds: string[];
  correctedPatternIds: string[];
  adaptationState: {
    explanationRecommendation: ExplanationDepth;
    questScopeRecommendation: QuestIntensity;
    guidanceModeRecommendation: GuidanceMode;
    confidence: AdaptationConfidence;
    reasons: string[];
  };
  dataQuality: {
    syntheticProjectsExcluded: number;
    deletedProjectsExcluded: number;
    legacyLimitations: string[];
    missingSources: string[];
  };
};

export type ActiveFounderPattern = FounderPatternReference & {
  headline: string;
  explanation: string;
  limitations: string[];
};

export type PersonalizationExclusionReason =
  | "dismissed"
  | "corrected"
  | "not_comparable"
  | "insufficient_evidence"
  | "deleted_source"
  | "synthetic_source"
  | "current_context_conflict"
  | "personalization_disabled";

export type PersonalizationContext = {
  relevantPatterns: ActiveFounderPattern[];
  excludedPatterns: Array<{ patternId: string; reason: PersonalizationExclusionReason }>;
  sources: Array<{ kind: "explicit_preference" | "founder_profile" | "current_project" | "cross_project_pattern"; reference: string }>;
  explanation: string[];
};

export type FounderIntelligenceBuildInput = {
  userId: string;
  now?: Date;
  preferences?: Partial<FounderGuidancePreferences>;
  latestDeclaredContext?: FounderIntelligenceProfile["declaredContext"];
  projectSnapshots: Array<{
    projectId: string;
    eligibilityStatus: "fully_eligible" | "partially_eligible" | "ineligible";
    lifecycleOutcome?: string | null;
    stageReached?: string | null;
    experimentCount: number;
    meaningfulDecisionCount: number;
    externalEvidenceCount: number;
    revenueEvidenceCount: number;
  }>;
  patterns: ActiveFounderPattern[];
  dismissedPatternIds?: string[];
  correctedPatternIds?: string[];
  completedQuestCount?: number;
  closureReflectionCount?: number;
  syntheticProjectsExcluded?: number;
  deletedProjectsExcluded?: number;
  learningDataThrough?: string | null;
  legacyLimitations?: string[];
  missingSources?: string[];
};

