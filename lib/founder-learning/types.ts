export type LearningEvidenceTier = "early_indication" | "repeated_pattern" | "strong_personal_pattern";
export type LearningInsightCategory = "validation" | "stage" | "blocker" | "assumption" | "decision" | "constraint" | "project_type" | "outcome" | "lesson";
export type LearningEligibility = "fully_eligible" | "partially_eligible" | "ineligible";

export type LearningExperiment = { id: string; evidenceType: string; status: string; peopleContacted: number; replies: number; painConfirmed: number; interestedUsers: number; waitlistSignups: number; paymentIntent: number; revenueCents: number; createdAt: string; updatedAt: string; validationPathType?: string | null };
export type LearningDecision = { id: string; decisionType: string; createdAt: string; experimentId?: string | null };
export type LearningAssumption = { id: string; key: string; status: "untested" | "supported" | "contradicted" | "inconclusive"; updatedAt: string };
export type LearningPathEvent = { id: string; eventType: string; nextPathType?: string | null; createdAt: string };
export type LearningStageEvent = { id: string; previousStage: string; newStage: string; createdAt: string };
export type LearningLifecycleEvent = { id: string; eventType: string; createdAt: string };
export type LearningReflection = { id: string; whatWasLearned: string; biggestMistake?: string | null; closureReason: string; wouldDoDifferently: string; createdAt: string };

export type LearningProjectRecord = {
  id: string; title: string; projectType: string; status: string; lifecycleStatus: string; createdAt: string; updatedAt: string;
  deletedAt?: string | null; excludedAt?: string | null; synthetic?: boolean;
  constraints: { hoursPerWeek?: number | null; budgetBand?: string | null; technicalAbility?: string | null; riskTolerance?: number | null };
  experiments: LearningExperiment[]; decisions: LearningDecision[]; assumptions: LearningAssumption[]; pathEvents: LearningPathEvent[];
  stageEvents: LearningStageEvent[]; lifecycleEvents: LearningLifecycleEvent[]; reflection?: LearningReflection | null;
};

export type ComparableProjectSummary = {
  projectId: string; projectTitle: string; projectType: string; eligibility: LearningEligibility; eligibilityReason: string;
  lifecycleOutcome: string; stageReached: string; founderConstraints: LearningProjectRecord["constraints"];
  validationMethods: string[]; evidenceTypes: string[]; meaningfulDecisionCount: number; experimentCount: number;
  customerConversationCount: number; waitlistSignalCount: number; paymentIntentCount: number; revenueEvidenceCount: number;
  externalEvidenceCount: number; timeToFirstEvidenceDays?: number; timeInStages: Record<string,number>;
  blockerCategories: string[]; assumptionSummary: Record<string,Record<string,number>>; decisionTypes: string[];
  closureReflectionIds: string[]; limitations: string[]; sourceUpdatedAt: string;
};

export type PatternSource = { projectId: string; role: "supporting" | "contradicting"; sourceKind: "project" | "timeline_event" | "decision" | "experiment" | "reflection" | "assumption" | "validation_path"; sourceId: string };
export type FounderPatternCandidate = {
  insightKey: string; category: LearningInsightCategory; headline: string; explanation: string; evidenceTier: LearningEvidenceTier;
  supportingProjectIds: string[]; contradictingProjectIds: string[]; sources: PatternSource[]; limitations: string[];
  dimensions: Record<string,string|number|boolean|null>; evidenceFingerprint: string; dataThrough: string;
};

export type FounderLearningSnapshot = {
  generatedAt: string; dataThrough: string; eligibleProjectCount: number; completedProjectCount: number; pausedProjectCount: number;
  stoppedProjectCount: number; launchedProjectCount: number; revenueProjectCount: number; projectSummaries: ComparableProjectSummary[];
  insights: FounderPatternCandidate[]; dataQuality: { sufficientForPatterns: boolean; missingSources: string[]; legacyLimitations: string[] };
};

