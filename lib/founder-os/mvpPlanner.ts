import type { MvpPlan, UserOpportunityInput } from "@/lib/founder-os/types";
import { BUSINESS_TYPE_LABELS, compactList, currencyBudget, firstSkill, productNoun } from "@/lib/founder-os/helpers";
import { inferProjectType, inferSolutionCategory } from "@/lib/founder-os/projectContext";

export function createMvpPlan(input: UserOpportunityInput): MvpPlan {
  const skills = compactList(input.skills);
  const type = BUSINESS_TYPE_LABELS[input.businessType];
  const noun = productNoun(input);
  const contextText = `${input.existingIdea ?? ""} ${input.targetAudience} ${input.interests}`;
  const projectType = inferProjectType({ businessType: input.businessType, text: contextText }).type;
  const solutionCategory = inferSolutionCategory(contextText).category;
  const release = releaseNounFor(projectType, solutionCategory);
  const audience = audienceWord(contextText, projectType);
  const pace = executionPace(input);
  const complexity = input.businessType === "ai_tool" || input.businessType === "saas" ? "Medium" : input.businessType === "e_commerce" ? "Medium" : "Low";
  const coreFlow = firstCoreFlow(input, projectType);

  return {
    featureList: [
      `${coreFlow} intake`,
      `${pace.outputDepth} output for ${audience}`,
      pace.allowBuild ? `Saved workspace or ${audience} progress tracker` : "Manual follow-up tracker",
      pace.allowPaidTools ? "Email capture and follow-up loop" : "Free form or spreadsheet interest list",
      pace.allowBuild ? "Simple analytics for what users complete" : "Manual notes on replies and objections",
    ],
    mustHaveFeatures: [
      `A single focused flow that creates the first useful ${noun}`,
      "Clear before/after promise on the landing page",
      pace.allowBuild ? "Manual review path so quality can improve quickly" : "Manual delivery path before software automation",
      pace.allowBuild ? "Export/share button for the generated result" : "One shareable sample result",
    ],
    niceToHaveFeatures: [
      pace.allowBuild ? "AI refinement after users request it" : "No-code templates after the pilot works",
      "Integrations with external tools",
      "Referral rewards after users complete the first useful outcome",
    ],
    doNotBuildYet: [
      "Complex team permissions",
      "Native mobile apps",
      "A marketplace",
      `Advanced automations before ${audience} prove the core workflow`,
      ...(pace.allowBuild ? [] : ["Custom code before one manual pilot gets a clear yes"]),
    ],
    technicalComplexity: complexity,
    suggestedStack: suggestedStack(input, skills),
    sevenDayBuildPlan: [
      `Day 1: ${pace.researchAction}`,
      `Day 2: Create a simple ${release} page and collect interest.`,
      `Day 3: ${pace.day3}`,
      `Day 4: ${pace.day4}`,
      `Day 5: ${pace.day5}`,
      `Day 6: Invite ${pace.inviteCount} ${audience} manually and watch where they get stuck.`,
      `Day 7: ${pace.day7}`,
    ],
    thirtyDayLaunchPlan: [
      `Week 1: Ship the smallest credible ${release}.`,
      `Week 2: Run ${pace.monthlyConversationCount} ${audience} conversations and collect evidence.`,
      pace.allowPaidTools ? "Week 3: Add the first paid tier only around a feature users specifically requested." : "Week 3: Sell one tiny manual pilot before adding paid software.",
      pace.aggressive ? "Week 4: Launch in two communities and chase the first 100 serious users." : "Week 4: Share proof-driven updates in one trusted channel and decide whether to continue.",
    ],
  };
}

function executionPace(input: UserOpportunityInput) {
  const skillText = compactList(input.skills).join(" ").toLowerCase();
  const technical = /\b(coding|programming|engineering|developer|typescript|react|python|sql|automation)\b/.test(skillText);
  const lowTime = input.timePerWeek <= 5;
  const lowBudget = input.budget <= 100;
  const lowRisk = input.riskTolerance <= 3;
  const aggressive = input.timePerWeek >= 20 && input.budget >= 1000 && input.riskTolerance >= 7;
  const allowBuild = technical && !lowTime && input.budget >= 50;
  const allowPaidTools = input.budget >= 250 && !lowRisk;

  if (lowTime || lowBudget || lowRisk || !technical) {
    return {
      aggressive: false,
      allowBuild,
      allowPaidTools,
      outputDepth: "manual sample",
      inviteCount: lowRisk ? 5 : 8,
      monthlyConversationCount: lowTime ? 8 : 15,
      researchAction: "Ask 3 people about the problem and write the exact words they use.",
      day3: "Create one manual sample result before building software.",
      day4: "Deliver the sample by hand and ask what feels useful or confusing.",
      day5: "Turn repeated feedback into a one-page testable workflow.",
      day7: "Decide whether the pain is strong enough for another week.",
    };
  }

  if (aggressive) {
    return {
      aggressive: true,
      allowBuild,
      allowPaidTools,
      outputDepth: "interactive prototype",
      inviteCount: 20,
      monthlyConversationCount: 40,
      researchAction: "Interview 8 target users and define the sharpest paid wedge.",
      day3: "Build the core input form, saved result model, and first workflow screen.",
      day4: "Build the output experience and one measurable success moment.",
      day5: "Add export/share, event tracking, and a payment-intent CTA.",
      day7: "Ship to a small tester list and ask for payment intent.",
    };
  }

  return {
    aggressive: false,
    allowBuild,
    allowPaidTools,
    outputDepth: "focused prototype",
    inviteCount: 10,
    monthlyConversationCount: 20,
    researchAction: "Interview 5 target users and write the exact pain-point promise.",
    day3: "Build or mock the core input flow.",
    day4: "Build the first output experience.",
    day5: "Add export/share and basic completion tracking.",
    day7: "Tighten copy, fix friction, and ask for payment intent.",
  };
}

function firstCoreFlow(input: UserOpportunityInput, projectType: string) {
  const idea = `${input.existingIdea ?? ""} ${input.interests}`.toLowerCase();
  if (/\bstudy|homework|notes|test|exam\b/.test(idea) || projectType === "Education Tool") return "Study-plan";
  if (/\brestaurant|local|client|service\b/.test(idea) || input.businessType === "local_service") return "Client-offer";
  if (/\bcontent|youtube|tiktok|newsletter|creator\b/.test(idea)) return "Content-idea";
  if (/\bhockey|sports|training|gear|physical\b/.test(idea) || projectType === "Physical Product") return "Prototype-feedback";
  return "Problem";
}

function releaseNounFor(projectType: string, solutionCategory: string) {
  if (projectType === "Education Tool" || solutionCategory === "Education") return "pilot";
  if (projectType === "Agency" || projectType === "Consulting" || projectType === "Local Business") return "service offer";
  if (projectType === "Course" || projectType === "Coaching") return "pilot lesson";
  if (projectType === "Community") return "private group";
  if (projectType === "Physical Product" || projectType === "Hardware") return "prototype test";
  return "private alpha";
}

function audienceWord(text: string, projectType: string) {
  if (/\bstudent|school|homework|exam/i.test(text) || projectType === "Education Tool") return "students";
  if (/\bcreator|youtube|tiktok|newsletter/i.test(text)) return "creators";
  if (projectType === "Agency" || projectType === "Consulting" || projectType === "Local Business") return "clients";
  if (projectType === "Community") return "members";
  return "users";
}

function suggestedStack(input: UserOpportunityInput, skills: string[]) {
  if (input.businessType === "local_service") {
    return ["Landing page", "Airtable/Supabase CRM", "Stripe payment link", "Calendly or simple booking form", `${firstSkill(input)} as the fulfillment wedge`];
  }
  if (input.businessType === "digital_product" || input.businessType === "content_business") {
    return ["Next.js landing page", "Supabase email capture", "Resend nurture emails", "Stripe payment link", "Markdown/Notion-backed content system"];
  }
  return [
    "Next.js",
    "TypeScript",
    "Tailwind CSS",
    "Supabase auth/database",
    input.businessType === "ai_tool" ? "Server-side AI provider abstraction" : "Server actions",
    `Starter budget: ${currencyBudget(input)}`,
    ...skills.slice(0, 2).map((skill) => `Use your ${skill} skill for unfair speed`),
  ];
}
