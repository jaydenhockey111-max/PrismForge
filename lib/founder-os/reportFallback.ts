import { analyzeCompetitors } from "./competitorAnalyzer";
import { createContentPlan } from "./contentEngine";
import {
  BUSINESS_TYPE_LABELS,
  GOAL_LABELS,
  audienceLabel,
  firstInterest,
  firstSkill,
  ideaLabel,
  productNoun,
  projectSeed,
  projectTitle,
  seededPick,
} from "./helpers";
import { createLandingPageCopy } from "./landingPageGenerator";
import { createMarketValidation } from "./marketValidation";
import { createMonetizationPlan } from "./monetizationPlanner";
import { createMvpPlan } from "./mvpPlanner";
import { createOpportunityScore } from "./opportunityScoring";
import { createRoadmap } from "./roadmapGenerator";
import type { OpportunityReport, UserOpportunityInput } from "./types";

export function createMockOpportunityReport(input: UserOpportunityInput): OpportunityReport {
  const title = projectTitle(input);
  const audience = input.targetAudience.trim() || "ambitious beginners";
  const audienceLower = audienceLabel(input);
  const interest = firstInterest(input);
  const skill = firstSkill(input);
  const noun = productNoun(input);
  const typeLabel = BUSINESS_TYPE_LABELS[input.businessType].toLowerCase();
  const seed = projectSeed(input);
  const idea = ideaLabel(input);
  const founderGoal = GOAL_LABELS[input.goal].toLowerCase();
  const urgency = seededPick(
    [
      "keep losing time to scattered advice and unfinished attempts",
      "struggle to turn vague motivation into a clear weekly plan",
      "need a faster way to decide what is worth building or buying",
      "have enough intent to act, but not enough clarity to move confidently",
    ],
    `${seed}:urgency`,
  );
  const moneyAngle = seededPick(
    [
      "sell a focused shortcut to a painful, repeated workflow",
      "package a clear outcome into a simple recurring product",
      "start with a manual concierge version before automating the workflow",
      "charge for speed, clarity, and accountability instead of generic advice",
    ],
    `${seed}:money-angle`,
  );

  return {
    generatedAt: new Date().toISOString(),
    input,
    score: createOpportunityScore(input),
    summary: {
      title,
      oneSentenceIdea: `${idea} is a ${typeLabel} ${noun} for ${audienceLower} who want to make progress on ${interest} without guessing what to do next.`,
      targetCustomer: audience,
      painPoint: `${audience} ${urgency}, especially when they only have ${input.timePerWeek || 3} hours/week and need proof instead of more planning.`,
      whyNow: `AI, no-code infrastructure, short-form distribution, and niche communities make it cheaper than ever for someone with ${skill} skills to validate a focused ${noun} quickly.`,
      whyThisCouldMakeMoney: `The strongest path is to ${moneyAngle}. This fits the founder goal of ${founderGoal}.`,
      businessModel: input.businessType === "local_service" ? "Paid setup/service packages with optional recurring support." : "Freemium entry point with paid Pro/Founder plans for repeated use, exports, and advanced workflows.",
    },
    marketValidation: createMarketValidation(input),
    competitors: analyzeCompetitors(input),
    mvpPlan: createMvpPlan(input),
    monetizationPlan: createMonetizationPlan(input),
    contentPlan: createContentPlan(input),
    landingPageCopy: createLandingPageCopy(input),
    executionRoadmap: createRoadmap(input),
    generationMode: "mock",
  };
}
