import type { BusinessType, FounderGoal, UserOpportunityInput } from "@/lib/founder-os/types";
import { BUSINESS_TYPE_LABELS, compactList, firstInterest, productNoun, titleCase } from "./helpers";
import { detectPlaceholderAnswer } from "../input-quality/detectPlaceholderAnswer";
import { synthesizeProjectConcept } from "./projectContext";

export type GuidedIdeaOption = {
  title: string;
  targetAudience: string;
  painPoint: string;
  solution: string;
  smallestMvp: string;
  whyItFits: string;
};

export type SanitizedFounderInput = UserOpportunityInput & {
  guidedIdeaUsed: boolean;
  recoveredFields: string[];
  guidedIdeaOptions: GuidedIdeaOption[];
};

type RawFounderInput = Partial<Omit<UserOpportunityInput, "budget" | "timePerWeek" | "riskTolerance">> & {
  budget?: number;
  timePerWeek?: number;
  riskTolerance?: number;
};

export function sanitizeFounderInput(input: UserOpportunityInput): SanitizedFounderInput {
  const recoveredFields: string[] = [];
  const cleaned: UserOpportunityInput = { ...input };

  const interestsBad = detectPlaceholderAnswer(cleaned.interests, "interests");
  const skillsBad = detectPlaceholderAnswer(cleaned.skills, "skills");
  if (interestsBad.isPlaceholder) {
    cleaned.interests = fallbackInterest(cleaned);
    recoveredFields.push("interests");
  }
  if (skillsBad.isPlaceholder) {
    cleaned.skills = fallbackSkill(cleaned);
    recoveredFields.push("skills");
  }

  const ideaBad = detectPlaceholderAnswer(cleaned.existingIdea, "idea");
  const audienceBad = detectPlaceholderAnswer(cleaned.targetAudience, "targetAudience");
  const guidedIdeaOptions = createGuidedIdeaOptions(cleaned);

  if (audienceBad.isPlaceholder) {
    cleaned.targetAudience = guidedIdeaOptions[0]?.targetAudience ?? inferAudience(cleaned);
    recoveredFields.push("targetAudience");
  }

  if (!cleaned.existingIdea || ideaBad.isPlaceholder) {
    cleaned.existingIdea = guidedIdeaOptions[0]?.title ?? `${titleCase(firstInterest(cleaned))} ${titleCase(productNoun(cleaned))}`;
    recoveredFields.push("existingIdea");
  }

  return {
    ...cleaned,
    guidedIdeaUsed: recoveredFields.includes("existingIdea") || recoveredFields.includes("targetAudience"),
    recoveredFields,
    guidedIdeaOptions,
  };
}

export function createGuidedIdeaOptions(input: RawFounderInput): GuidedIdeaOption[] {
  const businessType = input.businessType ?? "ai_tool";
  const goal = input.goal ?? "side_income";
  const interest = meaningfulFirst(compactList(input.interests ?? ""), "student productivity");
  const skill = meaningfulFirst(compactList(input.skills ?? ""), "research");
  const audience = inferAudience({ ...input, interests: input.interests ?? interest, skills: input.skills ?? skill, businessType, goal } as UserOpportunityInput);
  const hours = Math.max(1, Number(input.timePerWeek ?? 5));
  const budget = Math.max(0, Number(input.budget ?? 0));

  const base = ideaCategory(interest, skill, businessType);
  const ideaIsUsable = Boolean(input.existingIdea && !detectPlaceholderAnswer(input.existingIdea, "idea").isPlaceholder);
  const synthesized = synthesizeProjectConcept({
    interests: input.interests ?? interest,
    skills: input.skills ?? skill,
    budget,
    timePerWeek: hours,
    targetAudience: audience,
    businessType,
    goal,
    riskTolerance: Number(input.riskTolerance ?? 5),
    existingIdea: ideaIsUsable ? input.existingIdea : undefined,
  });
  const lowBudget = budget <= 150;
  const tightTime = hours <= 5;

  return [
    {
      title: (synthesized.confidence === "low" ? `${titleCase(base)} for ${titleCase(audience)}` : synthesized.concept).slice(0, 80),
      targetAudience: audience,
      painPoint: `${audience} need a simpler way to make progress on ${interest} without wasting time on scattered advice.`,
      solution: synthesized.confidence === "low" ? `${businessTypeLabel(businessType)} that turns ${interest} tasks into a clear weekly action plan.` : synthesized.oneSentenceDescription,
      smallestMvp: lowBudget || tightTime ? "A manual concierge version using a form, spreadsheet, and copied weekly plan." : "A simple landing page plus one core workflow users can test in under 10 minutes.",
      whyItFits: `Uses your ${skill} skill, fits ${hours} hours/week, and can start with ${budgetLabel(budget)}.`,
    },
    {
      title: `${titleCase(interest)} Validation Sprint`,
      targetAudience: audience,
      painPoint: `${audience} are unsure which ${interest} problem is worth solving first.`,
      solution: `A lightweight service or template that helps them choose one next action and track results.`,
      smallestMvp: "A paid or free template plus 10 direct customer interviews.",
      whyItFits: `Good for the goal: ${goalLabel(goal)}. It starts with proof instead of code.`,
    },
    {
      title: `${titleCase(interest)} Micro-Toolkit`,
      targetAudience: audience,
      painPoint: `${audience} repeat the same messy workflow and do not have a focused toolkit for it.`,
      solution: `A tiny ${productNoun({ ...input, businessType } as UserOpportunityInput)} with checklists, scripts, and one guided workflow.`,
      smallestMvp: "A Notion/Google Doc/one-page prototype tested with 10 people.",
      whyItFits: `Low-cost, fast to test, and based on ${skill} rather than heavy infrastructure.`,
    },
  ];
}

export function hasLowQualityProjectOutput(input: { title?: string | null; targetAudience?: string | null; painPoint?: string | null }) {
  return (
    detectPlaceholderAnswer(input.title, "idea").isPlaceholder ||
    detectPlaceholderAnswer(input.targetAudience, "targetAudience").isPlaceholder ||
    detectPlaceholderAnswer(input.painPoint, "idea").isPlaceholder
  );
}

function inferAudience(input: UserOpportunityInput) {
  const idea = `${input.existingIdea ?? ""} ${input.interests ?? ""}`.toLowerCase();
  if (/\bstudent|homework|study|school|class|test\b/.test(idea)) return "high school students";
  if (/\bhockey|sports|fitness|training|athlete\b/.test(idea)) return "youth athletes and coaches";
  if (/\bcreator|tiktok|youtube|content|newsletter\b/.test(idea)) return "early creators";
  if (/\blocal|restaurant|gym|salon|small business\b/.test(idea)) return "local small business owners";
  if (/\bteacher|education|classroom\b/.test(idea)) return "teachers";
  if (/\bparent|family\b/.test(idea)) return "busy parents";
  if (/\bfounder|startup|business\b/.test(idea)) return "first-time founders";
  return "busy beginners";
}

function ideaCategory(interest: string, skill: string, businessType: BusinessType) {
  if (/\bhockey|sports|fitness|training\b/i.test(interest)) return "practice planner";
  if (/\bstudy|student|school|homework\b/i.test(interest)) return "study coach";
  if (/\bcontent|creator|tiktok|youtube\b/i.test(interest)) return "content workflow";
  if (/\bfinance|budget|money\b/i.test(interest)) return "budget assistant";
  if (businessType === "local_service") return `${skill} service`;
  return `${interest} ${productNoun({ businessType } as UserOpportunityInput)}`;
}

function fallbackInterest(input: RawFounderInput) {
  if (input.existingIdea && !detectPlaceholderAnswer(input.existingIdea, "idea").isPlaceholder) return input.existingIdea;
  return "student productivity";
}

function fallbackSkill(input: RawFounderInput) {
  if (input.businessType === "content_business") return "writing";
  if (input.businessType === "local_service") return "customer service";
  return "research";
}

function meaningfulFirst(items: string[], fallback: string) {
  return items.find((item) => !detectPlaceholderAnswer(item, "generic").isPlaceholder) ?? fallback;
}

function businessTypeLabel(type: BusinessType) {
  return BUSINESS_TYPE_LABELS[type].toLowerCase();
}

function budgetLabel(value: number) {
  return value <= 0 ? "$0 budget" : `$${value} budget`;
}

function goalLabel(goal: FounderGoal) {
  return goal.replace(/_/g, " ");
}
