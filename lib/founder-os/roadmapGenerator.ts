import type { ExecutionRoadmap, UserOpportunityInput } from "@/lib/founder-os/types";
import { firstInterest, productNoun } from "@/lib/founder-os/helpers";
import { inferProjectType, inferSolutionCategory } from "@/lib/founder-os/projectContext";

export function createRoadmap(input: UserOpportunityInput): ExecutionRoadmap {
  const audience = input.targetAudience;
  const interest = firstInterest(input);
  const noun = productNoun(input);
  const contextText = `${input.existingIdea ?? ""} ${input.targetAudience} ${input.interests} ${input.businessType}`;
  const projectType = inferProjectType({ businessType: input.businessType, text: contextText }).type;
  const solutionCategory = inferSolutionCategory(contextText).category;
  const releaseNoun = releaseNounFor(projectType, solutionCategory);
  const audienceNoun = /\bstudent|school|homework|exam/i.test(contextText) ? "students" : /\bcreator|youtube|tiktok|newsletter/i.test(contextText) ? "creators" : "target users";
  const plan = roadmapPace(input);

  return {
    today: [
      plan.todayPromise(audience),
      `List ${plan.listSize} people or communities where the target customer already hangs out.`,
      `Create one clear ${releaseNoun} signup or feedback CTA.`,
      `Send ${plan.firstMessages} pain-discovery messages without pitching.`,
    ],
    thisWeek: [
      `Interview ${plan.weeklyInterviews} target users and write down exact phrases they use.`,
      plan.buildStep(noun),
      `Publish ${plan.contentPieces} useful ${plan.contentPieces === 1 ? "post" : "posts"} that teach the problem, not the product.`,
      `Ask the warmest ${audienceNoun} for the next small commitment.`,
    ],
    thisMonth: [
      `Ship a narrow ${releaseNoun} with one measurable success moment.`,
      `Collect feedback from the first successful ${audienceNoun}.`,
      "Launch a Pro tier with one feature tied to repeated usage.",
      "Create a weekly content cadence around what you learned.",
    ],
    first100UsersPlan: [
      `Start with niche communities around ${interest}; be useful before linking.`,
      `Offer ${plan.setupSessions} hands-on setup sessions in exchange for feedback/testimonials.`,
      "Turn every user question into a short-form video or SEO article.",
      "Add a referral loop after users complete the first meaningful outcome.",
    ],
    first1000RevenuePlan: [
      "Sell 10 discounted founder seats before adding more features.",
      "Package setup help as a temporary high-touch offer.",
      "Convert repeated manual work into the next premium feature.",
      "Raise pricing once users can point to a concrete saved-time or made-money outcome.",
    ],
    biggestRisks: [
      "Building for a broad audience before finding a painful niche",
      "Mistaking likes/views for purchase intent",
      "Overbuilding automation before the manual workflow is proven",
      "Pricing too low to support serious customer success",
    ],
    howToTestQuickly: [
      "Run a landing page test with one audience and one promise.",
      "Ask users to rank pain severity from 1-10 after interviews.",
      "Offer to solve the problem manually for a small payment.",
      `Track replies, ${releaseNoun} commitments, and paid intent before expanding scope.`,
    ],
  };
}

function roadmapPace(input: UserOpportunityInput) {
  const lowTime = input.timePerWeek <= 5;
  const lowBudget = input.budget <= 100;
  const lowRisk = input.riskTolerance <= 3;
  const highCapacity = input.timePerWeek >= 20 && input.budget >= 1000 && input.riskTolerance >= 7;
  const skillText = input.skills.toLowerCase();
  const technical = /\b(coding|developer|engineering|programming|automation)\b/.test(skillText);

  if (lowTime || lowBudget || lowRisk) {
    return {
      listSize: 10,
      firstMessages: 3,
      weeklyInterviews: 5,
      contentPieces: 1,
      setupSessions: 5,
      todayPromise: (audience: string) => `Write one plain promise for ${audience}, then cut anything you cannot test this week.`,
      buildStep: (noun: string) => `Create a manual concierge version of the ${noun}; do not build custom software yet.`,
    };
  }

  if (highCapacity && technical) {
    return {
      listSize: 40,
      firstMessages: 12,
      weeklyInterviews: 15,
      contentPieces: 5,
      setupSessions: 30,
      todayPromise: (audience: string) => `Write a sharp paid-pilot promise for ${audience} and define the one metric that proves it works.`,
      buildStep: (noun: string) => `Build a narrow prototype of the ${noun} after the first interviews confirm the pain.`,
    };
  }

  return {
    listSize: 20,
    firstMessages: 5,
    weeklyInterviews: 10,
    contentPieces: 3,
    setupSessions: 20,
    todayPromise: (audience: string) => `Write the one-sentence promise for ${audience}.`,
    buildStep: (noun: string) => `Build a concierge/manual version of the ${noun}.`,
  };
}

function releaseNounFor(projectType: string, solutionCategory: string) {
  if (projectType === "Education Tool" || solutionCategory === "Education") return "pilot";
  if (projectType === "Agency" || projectType === "Consulting" || projectType === "Local Business") return "service offer";
  if (projectType === "Course" || projectType === "Coaching") return "pilot lesson";
  if (projectType === "Community") return "private group";
  if (projectType === "Physical Product" || projectType === "Hardware") return "prototype test";
  return "private alpha";
}
