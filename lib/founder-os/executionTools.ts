import { createProjectContext } from "@/lib/founder-os/projectContext";
import type { BusinessType, Competitor, MonetizationPlan, OpportunityReport, VideoScriptConcept } from "@/lib/founder-os/types";
import { cleanGeneratedObject } from "@/lib/founder-os/copyQuality";

export type ValidationSurveyOutput = {
  questions: string[];
  outreachMessage: string;
};

export type CompetitiveBattlecardRow = {
  competitor: string;
  likelyWeakness: string;
  counterAdvantage: string;
};

export type PricingTierOutput = {
  name: string;
  price: string;
  positioning: string;
  features: string[];
};

export type SprintTaskOutput = {
  category: "Technical" | "Marketing" | "Validation";
  task: string;
  whyItMatters: string;
};

export function generateValidationSurvey(report: OpportunityReport): ValidationSurveyOutput {
  const context = createProjectContext({ report, status: "idea" });
  const pain = context.problem;
  const promise = report.mvpPlan.mustHaveFeatures[0] ?? report.summary.oneSentenceIdea ?? context.desiredOutcome;
  const validationMethod = context.recommendedValidation[0] ?? `Ask 5 ${context.language.userNoun} about the problem.`;

  return cleanGeneratedObject({
    questions: [
      `What is the most frustrating part of ${pain.toLowerCase()} right now?`,
      `How do you currently handle this, and what does that workaround cost you in time, money, energy, or stress?`,
      `If ${context.title} helped you ${promise.toLowerCase()}, how useful would that be from 1-10?`,
      `What would make you ignore or distrust a ${context.projectType.toLowerCase()} like this?`,
      `Would you try a small ${context.language.releaseNoun} if this solved the problem well? Why or why not?`,
    ],
    outreachMessage: `Hey — I’m testing a ${context.projectType.toLowerCase()} idea for ${context.audience}: ${context.oneSentenceDescription}. I’m not selling anything yet. I’m trying to understand how ${context.language.userNoun} deal with ${pain.toLowerCase()}. Could I send you 5 quick questions? Suggested test: ${validationMethod}`,
  });
}

export function generateCompetitiveBattlecard(report: OpportunityReport): CompetitiveBattlecardRow[] {
  const context = createProjectContext({ report, status: "idea" });
  const fallbackCompetitors: Competitor[] = [
    {
      name: "Manual workflow / spreadsheets",
      whatTheyDo: "Users solve the problem with docs, spreadsheets, or scattered notes.",
      strength: "Free and familiar",
      weakness: "Slow, inconsistent, and hard to repeat",
      pricing: "Free",
      opportunityGap: "Win by making the workflow faster and more guided.",
    },
    {
      name: "Generic AI chat tools",
      whatTheyDo: "Users ask broad AI tools for help.",
      strength: "Flexible",
      weakness: "No dedicated workflow, memory, or execution structure",
      pricing: "$20/mo+",
      opportunityGap: "Win by being more specific and outcome-driven.",
    },
  ];
  const competitors = (report.competitors.length ? report.competitors : fallbackCompetitors).slice(0, 3);
  return cleanGeneratedObject(competitors.map((competitor) => ({
    competitor: competitor.name,
    likelyWeakness: competitor.weakness || competitor.opportunityGap,
    counterAdvantage: `${context.title} can stand out by focusing on ${context.audience}, testing "${context.problem}", and delivering ${report.mvpPlan.mustHaveFeatures[0] ?? context.language.productNoun}.`,
  })));
}

export function generatePricingTiers(report: OpportunityReport): PricingTierOutput[] {
  const context = createProjectContext({ report, status: "idea" });
  const base = basePriceForType(report.input.businessType, report.monetizationPlan);
  const mustHave = report.mvpPlan.mustHaveFeatures.slice(0, 3);
  const premium = report.monetizationPlan.premiumTier.slice(0, 3);

  return cleanGeneratedObject([
    {
      name: "Free",
      price: "$0/mo",
      positioning: `For ${context.language.userNoun} trying the basic ${context.solutionCategory.toLowerCase()} workflow.`,
      features: [
        mustHave[0] ?? "Basic workflow access",
        "1 saved project or workspace",
        "Community-style support",
      ],
    },
    {
      name: "Pro",
      price: `$${base}/mo`,
      positioning: `For ${context.language.userNoun} who want repeatable progress on ${context.problem}.`,
      features: [
        ...new Set([...(mustHave.length ? mustHave : ["Full core workflow"]), ...(premium.length ? premium : ["Advanced exports", "Priority templates"])]),
      ].slice(0, 5),
    },
    {
      name: "Founder",
      price: "$49/mo",
      positioning: `For power users who need more guidance, exports, and accountability around this ${context.projectType.toLowerCase()}.`,
      features: [
        "Everything in Pro",
        "Higher usage limits with safety caps",
        "Advanced roadmap and progress tracking",
      ],
    },
  ]);
}

export function generateVideoScripts(report: OpportunityReport): VideoScriptConcept[] {
  const context = createProjectContext({ report, status: "idea" });
  const mustHave = report.mvpPlan.mustHaveFeatures[0] ?? report.mvpPlan.featureList[0] ?? context.language.productNoun;
  const secondFeature = report.mvpPlan.mustHaveFeatures[1] ?? report.mvpPlan.featureList[1] ?? "a faster workflow";
  const firstStep = report.mvpPlan.sevenDayBuildPlan[0] ?? context.recommendedValidation[0] ?? "validate before building too much";
  const price = report.monetizationPlan.suggestedPrice;
  const cta = report.landingPageCopy.cta || "Join the waitlist to get the first version.";

  return cleanGeneratedObject([
    {
      day: 1,
      hook: `Stop expanding ${context.title} before testing whether ${context.language.userNoun} actually need it.`,
      bodyScript: `Start with the real situation: ${context.problem}. The sharper move is to test one useful promise: ${mustHave}. Then watch whether real ${context.language.userNoun} respond, try it, or ask for more.`,
      cta,
    },
    {
      day: 2,
      hook: `Here is the tiny ${context.language.releaseNoun} I would test before spending months on this.`,
      bodyScript: `The first version is not the full dream. It is the learning machine. Start with ${mustHave}, add ${secondFeature}, and skip everything else until ${context.language.userNoun} respond. First step: ${firstStep}.`,
      cta,
    },
    {
      day: 3,
      hook: `If ${context.language.userNoun} will not commit to this outcome, the project is not ready yet.`,
      bodyScript: `The price or commitment test is the truth serum. The starting price is ${price}, but the real question is whether the outcome is painful enough. If yes, keep going. If no, tighten the audience and test again.`,
      cta,
    },
  ]);
}

export function generateSprintTasks(report: OpportunityReport): SprintTaskOutput[] {
  const context = createProjectContext({ report, status: "idea" });
  return cleanGeneratedObject([
    {
      category: "Validation",
      task: context.recommendedValidation[0] ?? `Send the validation survey to 10 ${context.language.userNoun} and collect at least 5 replies.`,
      whyItMatters: `This checks whether ${context.problem} is real before you invest more build time or money.`,
    },
    {
      category: "Technical",
      task: `${context.language.buildVerb} only this first slice: ${report.mvpPlan.mustHaveFeatures[0] ?? report.mvpPlan.featureList[0] ?? context.language.productNoun}.`,
      whyItMatters: `A narrow ${context.language.releaseNoun} creates evidence faster than a bloated first version.`,
    },
    {
      category: "Marketing",
      task: `Publish one short-form post using this hook: ${report.contentPlan.shortFormHooks[0] ?? report.contentPlan.shockValueAngle}.`,
      whyItMatters: `Early reactions tell you what language ${context.language.userNoun} understand and care about.`,
    },
  ]);
}

function basePriceForType(type: BusinessType, monetization: MonetizationPlan) {
  const explicit = monetization.suggestedPrice.match(/\$?(\d+)/);
  if (explicit) return Math.max(9, Number(explicit[1]));
  const map: Record<BusinessType, number> = {
    saas: 15,
    ai_tool: 15,
    digital_product: 19,
    local_service: 49,
    content_business: 15,
    e_commerce: 19,
  };
  return map[type];
}
