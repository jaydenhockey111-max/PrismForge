import { z } from "zod";
import { detectPlaceholderAnswer } from "../input-quality/detectPlaceholderAnswer";
import { BUSINESS_TYPES, FOUNDER_GOALS } from "./helpers";
import type { UserOpportunityInput } from "./types";

const MAX_TEXT_LENGTH = 800;

export type InputCoherenceResult =
  | { ok: true; input: UserOpportunityInput; warnings: string[] }
  | { ok: false; input: UserOpportunityInput; error: string; category: "invalid_input" };

export const canonicalUserOpportunityInputSchema = z.object({
  interests: cleanTextSchema("Tell PrismForge at least one real interest or area you care about.", 800),
  skills: cleanTextSchema("Add at least one skill you can use.", 800),
  budget: z.coerce.number().finite().min(0, "Budget cannot be negative.").max(1_000_000, "Use a realistic starter budget.").default(0),
  timePerWeek: z.coerce.number().finite().min(1, "Set at least 1 hour per week.").max(100, "Use a realistic weekly time budget.").default(5),
  targetAudience: cleanTextSchema("Describe who this is for.", 500),
  businessType: z.enum(BUSINESS_TYPES).catch("ai_tool"),
  goal: z.enum(FOUNDER_GOALS).catch("side_income"),
  riskTolerance: z.coerce.number().finite().min(1).max(10).default(5),
  existingIdea: z.preprocess((value) => normalizeInputText(value).slice(0, MAX_TEXT_LENGTH) || undefined, z.string().max(MAX_TEXT_LENGTH).optional()),
});

export function normalizeFounderInput(value: unknown) {
  return canonicalUserOpportunityInputSchema.safeParse(value);
}

export function assessFounderInputCoherence(input: UserOpportunityInput): InputCoherenceResult {
  const warnings: string[] = [];
  const idea = detectPlaceholderAnswer(input.existingIdea, "idea");
  const audience = detectPlaceholderAnswer(input.targetAudience, "targetAudience");
  const interests = detectPlaceholderAnswer(input.interests, "interests");
  const skills = detectPlaceholderAnswer(input.skills, "skills");

  const hasUsableIdea = Boolean(input.existingIdea && !idea.isPlaceholder);
  const hasUsableInterest = !interests.isPlaceholder;
  const hasUsableAudience = !audience.isPlaceholder;

  if (!hasUsableIdea && !hasUsableInterest && !hasUsableAudience) {
    return {
      ok: false,
      input,
      category: "invalid_input",
      error: "Add a little more detail about who this is for or what problem it solves so PrismForge can create a useful project.",
    };
  }

  if (!hasUsableAudience && !hasUsableIdea) {
    return {
      ok: false,
      input,
      category: "invalid_input",
      error: "Tell us who this is for or describe the problem you want to solve so PrismForge can build a useful project.",
    };
  }

  if (isSameMeaningfulPhrase([input.interests, input.skills, input.targetAudience, input.existingIdea ?? ""])) {
    return {
      ok: false,
      input,
      category: "invalid_input",
      error: "Your answers look identical. Add one specific audience or problem so PrismForge can create a real project.",
    };
  }

  if (input.timePerWeek <= 1) warnings.push("available_time_is_low");
  if (input.budget <= 0) warnings.push("budget_not_defined");
  if (skills.isPlaceholder) warnings.push("skills_recovered");
  if (idea.isPlaceholder) warnings.push("idea_recovered");

  return { ok: true, input, warnings };
}

export function canonicalInputKey(input: UserOpportunityInput) {
  return JSON.stringify({
    interests: stableText(input.interests),
    skills: stableText(input.skills),
    budget: Number(input.budget) || 0,
    timePerWeek: Number(input.timePerWeek) || 0,
    targetAudience: stableText(input.targetAudience),
    businessType: input.businessType,
    goal: input.goal,
    riskTolerance: Number(input.riskTolerance) || 0,
    existingIdea: stableText(input.existingIdea ?? ""),
  });
}

function cleanTextSchema(message: string, max: number) {
  return z.preprocess(
    (value) => normalizeInputText(value).slice(0, max),
    z.string().min(2, message).max(max),
  );
}

export function normalizeInputText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function stableText(value: string) {
  return normalizeInputText(value).replace(/\s+/g, " ").toLowerCase();
}

function isSameMeaningfulPhrase(values: string[]) {
  const normalized = values
    .map(stableText)
    .filter((value) => value.length >= 4 && !detectPlaceholderAnswer(value, "generic").isPlaceholder);
  if (normalized.length < 3) return false;
  return new Set(normalized).size === 1;
}
