import type { OpportunityScore, UserOpportunityInput } from "@/lib/founder-os/types";
import { BUSINESS_TYPE_LABELS, clamp, compactList, firstSkill, seededNumber } from "@/lib/founder-os/helpers";

export function createOpportunityScore(input: UserOpportunityInput): OpportunityScore {
  const interests = compactList(input.interests);
  const skills = compactList(input.skills);
  const seed = JSON.stringify(input).toLowerCase();

  const demand = clamp(58 + Math.min(18, interests.length * 4) + audienceBonus(input) + seededNumber(`${seed}:demand`, -6, 8));
  const competitionRaw = 54 + businessCompetitionBonus(input.businessType) + seededNumber(`${seed}:competition`, -8, 10);
  const competition = clamp(competitionRaw);
  const monetization = clamp(50 + budgetBonus(input.budget) + goalBonus(input.goal) + seededNumber(`${seed}:money`, -4, 12));
  const easeOfMvp = clamp(70 + timeBonus(input.timePerWeek) + skillBonus(skills.length) + mvpTypeBonus(input.businessType) - riskDrag(input.riskTolerance));
  const virality = clamp(45 + viralityTypeBonus(input.businessType) + Math.min(18, interests.length * 3) + seededNumber(`${seed}:viral`, -5, 15));
  const founderFit = clamp(55 + skillBonus(skills.length) + (input.existingIdea ? 8 : 0) + seededNumber(`${seed}:fit`, -3, 12));
  const recurringRevenue = clamp(40 + recurringTypeBonus(input.businessType) + (input.goal === "subscription_saas" ? 18 : 0) + seededNumber(`${seed}:rr`, -4, 9));

  const overall = clamp(
    demand * 0.18 +
      competition * 0.12 +
      monetization * 0.17 +
      easeOfMvp * 0.15 +
      virality * 0.12 +
      founderFit * 0.16 +
      recurringRevenue * 0.1,
  );

  const typeLabel = BUSINESS_TYPE_LABELS[input.businessType].toLowerCase();

  return {
    overall,
    demand,
    competition,
    monetization,
    easeOfMvp,
    virality,
    founderFit,
    recurringRevenue,
    breakdown: [
      {
        key: "demand",
        label: "Demand",
        score: demand,
        explanation: `${input.targetAudience} plus ${interests[0] ?? "your core interest"} creates a niche demand hypothesis to test with real people.`,
      },
      {
        key: "competition",
        label: "Competition",
        score: competition,
        explanation: `Competition is a research hypothesis: likely alternatives may exist, and the job is to find whether a sharper ${typeLabel} is useful.`,
      },
      {
        key: "monetization",
        label: "Monetization",
        score: monetization,
        explanation: `The revenue path is a hypothesis: test whether speed, clarity, or saved effort is valuable enough to pay for.`,
      },
      {
        key: "easeOfMvp",
        label: "Ease of MVP",
        score: easeOfMvp,
        explanation: `${Math.round(input.timePerWeek)} hours/week and ${firstSkill(input)} are enough for a lean first version if scope stays disciplined.`,
      },
      {
        key: "virality",
        label: "Virality/content",
        score: virality,
        explanation: `The idea has content angles around before/after transformations, public experiments, and niche pain-point storytelling.`,
      },
      {
        key: "founderFit",
        label: "Founder fit",
        score: founderFit,
        explanation: `Your interests and skills overlap enough to make the first 30 days feel like progress instead of homework.`,
      },
      {
        key: "recurringRevenue",
        label: "Recurring revenue",
        score: recurringRevenue,
        explanation: `Recurring potential depends on turning the product into a weekly habit or ongoing workflow for ${input.targetAudience}.`,
      },
    ],
  };
}

function audienceBonus(input: UserOpportunityInput) {
  const audience = input.targetAudience.toLowerCase();
  if (/(business|founder|agency|student|parent|creator|team|professional|teacher|coach)/.test(audience)) return 9;
  return 3;
}

function businessCompetitionBonus(type: UserOpportunityInput["businessType"]) {
  const map = {
    saas: 7,
    ai_tool: 4,
    digital_product: 12,
    local_service: 15,
    content_business: 9,
    e_commerce: 2,
  };
  return map[type];
}

function budgetBonus(budget: number) {
  if (budget >= 5000) return 18;
  if (budget >= 1000) return 12;
  if (budget >= 250) return 7;
  return 2;
}

function goalBonus(goal: UserOpportunityInput["goal"]) {
  if (goal === "full_time_business") return 14;
  if (goal === "subscription_saas") return 12;
  if (goal === "side_income") return 9;
  if (goal === "viral_app") return 6;
  return 4;
}

function timeBonus(hours: number) {
  if (hours >= 25) return 8;
  if (hours >= 10) return 5;
  return 0;
}

function skillBonus(count: number) {
  return Math.min(15, count * 5);
}

function mvpTypeBonus(type: UserOpportunityInput["businessType"]) {
  const map = {
    saas: -2,
    ai_tool: -4,
    digital_product: 12,
    local_service: 10,
    content_business: 8,
    e_commerce: 0,
  };
  return map[type];
}

function riskDrag(riskTolerance: number) {
  return riskTolerance <= 3 ? 6 : riskTolerance >= 8 ? -3 : 0;
}

function viralityTypeBonus(type: UserOpportunityInput["businessType"]) {
  const map = {
    saas: 8,
    ai_tool: 16,
    digital_product: 9,
    local_service: 7,
    content_business: 20,
    e_commerce: 10,
  };
  return map[type];
}

function recurringTypeBonus(type: UserOpportunityInput["businessType"]) {
  const map = {
    saas: 26,
    ai_tool: 23,
    digital_product: 5,
    local_service: 12,
    content_business: 14,
    e_commerce: 8,
  };
  return map[type];
}
