import {
  audienceLabel,
  firstSkill,
  ideaLabel,
  productNoun,
  projectTitle,
} from "./helpers";
import { createOpportunityScore } from "./opportunityScoring";
import type { OpportunityReport, UserOpportunityInput } from "./types";

export function createMockOpportunityReport(input: UserOpportunityInput): OpportunityReport {
  const title = projectTitle(input);
  const audience = input.targetAudience.trim() || "ambitious beginners";
  const audienceLower = audienceLabel(input);
  const skill = firstSkill(input);
  const noun = productNoun(input);
  const idea = ideaLabel(input);

  return {
    generatedAt: new Date().toISOString(),
    input,
    score: createOpportunityScore(input),
    summary: {
      title,
      oneSentenceIdea: `${idea} is a starting ${noun} for ${audienceLower}.`,
      targetCustomer: audience,
      painPoint: `The problem for ${audienceLower} still needs validation.`,
      whyNow: `Use ${input.timePerWeek || 3} hours/week and your ${skill} skills to run a small test.`,
      whyThisCouldMakeMoney: "Whether people will pay is not known yet.",
      businessModel: "Start with a small paid pilot before choosing a pricing model.",
    },
    marketValidation: {
      searchDemandAssumptions: ["Search for the words this audience uses to describe the problem."],
      socialDemandAssumptions: ["Ask target users whether this problem is important enough to solve."],
      competitorLandscape: "Alternatives and demand still need real-world validation.",
      existingAlternatives: ["Unknown — ask users what they use today."],
      userComplaints: ["Hypothesis: the audience has a problem worth testing."],
      underservedAngle: "Start with one narrow problem and test it with real people.",
      confidenceNotes: ["No external evidence has been collected yet."],
    },
    competitors: [],
    mvpPlan: {
      featureList: ["One manual or simple testable workflow"],
      mustHaveFeatures: ["A clear problem statement", "One way to collect feedback"],
      niceToHaveFeatures: [],
      doNotBuildYet: ["Advanced automation", "Extra integrations", "Native mobile apps"],
      technicalComplexity: "Low",
      suggestedStack: ["Use the simplest tools you already know"],
      sevenDayBuildPlan: ["Talk to 3 target users", "Make one simple test", "Record what happened"],
      thirtyDayLaunchPlan: ["Run a small test", "Review the evidence", "Decide whether to continue"],
    },
    monetizationPlan: {
      freeTier: ["A small manual or sample version"],
      premiumTier: ["A paid pilot only after useful evidence"],
      suggestedPrice: "Test willingness to pay before setting a price.",
      tierFeatureMap: [],
      upsellStrategy: "Do not add an upsell until users value the first outcome.",
      whyUsersWouldPay: "Whether users will pay is not known yet.",
    },
    contentPlan: {
      shortFormHooks: ["What is the hardest part of this problem today?"],
      videoScripts: [],
      tweetIdeas: ["Ask the audience how they solve this problem now."],
      redditAngles: ["Request examples of the current workaround."],
      seoArticleTitles: ["How does this audience solve this problem today?"],
      shockValueAngle: "Do not claim a result without evidence.",
      educationalAngle: "Share what the first customer conversations reveal.",
      buildingInPublicAngle: "Document the small test and what changes next.",
    },
    landingPageCopy: {
      heroHeadline: `Testing a simpler way for ${audienceLower}.`,
      subheadline: "This is an early test. The problem and value are not validated yet.",
      cta: "Share feedback",
      benefitBullets: ["A focused starting point", "A way to share what is missing"],
      socialProofPlaceholder: "No proof collected yet.",
      faq: [],
      pricingSectionCopy: "Pricing will be tested only after people find the first outcome useful.",
    },
    executionRoadmap: {
      today: ["Write the problem in one sentence and list three people to ask."],
      thisWeek: ["Talk to target users and record the exact words they use."],
      thisMonth: ["Run one small test based on the strongest repeated signal."],
      first100UsersPlan: ["Do not pursue scale before confirming one useful outcome."],
      first1000RevenuePlan: ["Do not forecast revenue before testing willingness to pay."],
      biggestRisks: ["The problem may not be important enough.", "The current workaround may be good enough."],
      howToTestQuickly: ["Ask five target users how they handle this problem now."],
    },
    generationMode: "mock",
  };
}
