import type { LearningEvidenceTier } from "./types";

export const LEARNING_POLICY = {
  minimumPatternProjects: 2,
  repeatedPatternProjects: 3,
  strongPatternProjects: 5,
  strongPatternSupport: 4,
  lowTimeHoursPerWeek: 5,
  calculationVersion: 1,
  maxProjectsPerFounder: 1000,
  maxSourceRowsPerType: 10000,
} as const;

export function evidenceTier(totalProjects: number, supportingProjects: number, contradictingProjects: number): LearningEvidenceTier {
  if (totalProjects >= LEARNING_POLICY.strongPatternProjects && supportingProjects >= LEARNING_POLICY.strongPatternSupport && contradictingProjects <= 1) return "strong_personal_pattern";
  if (totalProjects >= LEARNING_POLICY.repeatedPatternProjects && supportingProjects >= 2) return "repeated_pattern";
  return "early_indication";
}

export const EVIDENCE_TIER_LABELS: Record<LearningEvidenceTier,string> = { early_indication: "Early indication", repeated_pattern: "Repeated pattern", strong_personal_pattern: "Strong personal pattern" };

