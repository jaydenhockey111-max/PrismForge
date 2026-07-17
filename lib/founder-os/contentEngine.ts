import type { ContentPlan, UserOpportunityInput } from "@/lib/founder-os/types";
import { audienceLabel, firstInterest, ideaLabel, productNoun, projectSeed, seededPick } from "@/lib/founder-os/helpers";
import { inferProjectType, inferSolutionCategory } from "@/lib/founder-os/projectContext";

export function createContentPlan(input: UserOpportunityInput): ContentPlan {
  const interest = firstInterest(input);
  const audience = audienceLabel(input);
  const noun = productNoun(input);
  const idea = ideaLabel(input);
  const seed = projectSeed(input);
  const inferred = inferProjectType({ businessType: input.businessType, text: `${input.existingIdea ?? ""} ${input.targetAudience} ${input.interests}` });
  const category = inferSolutionCategory(`${input.existingIdea ?? ""} ${input.targetAudience} ${input.interests}`);
  const audienceNoun = audienceWord(`${input.targetAudience} ${input.interests}`, inferred.type);
  const release = releaseWord(inferred.type, category.category);
  const proofHook = seededPick(
    [
      `I tested ${idea} with a tiny audience. Here is what surprised me.`,
      `I tried to solve ${interest} for ${audience} in 7 days. Here is what happened.`,
      `I asked ${audience} what felt hardest about ${interest}. Here is what I learned.`,
    ],
    `${seed}:proof-hook`,
  );

  return {
    shortFormHooks: [
      proofHook,
      `Stop expanding the idea. Test this tiny ${release} first.`,
      `The fastest way to test ${interest} with ${input.timePerWeek} hours/week.`,
      `I asked 10 ${audience} what felt hardest. Here is the pattern I am testing.`,
      `This is the $0 validation test I would run for ${audienceNoun}.`,
      `Before you build more, use this ${interest} checklist.`,
      `I turned a messy ${interest} problem into a tiny ${noun} test.`,
      `The boring niche idea that might beat a flashy generic app.`,
      `If I had ${input.budget ? `$${input.budget}` : "$100"} to start, I would test this first.`,
      `Watch me validate ${idea} before expanding the ${release}.`,
    ],
    videoScripts: [
      {
        title: "The pain-point teardown",
        script: `Open with a messy workflow ${audience} deal with. Show the cost of doing nothing. End with the tiny ${noun} you are testing.`,
      },
      {
        title: "Build in public sprint",
        script: `Show day-by-day progress, one useful step at a time. Keep the focus on what ${audienceNoun} said, not on vanity building.`,
      },
      {
        title: "Customer complaint montage",
        script: `List five problems to investigate with ${audience}. Turn each problem into a possible ${release} promise.`,
      },
      {
        title: "Landing page roast",
        script: "Compare generic copy against specific copy. Show why the specific promise converts better.",
      },
      {
        title: "First dollar experiment",
        script: "Show the exact offer, where you posted it, what people replied, and what you changed next.",
      },
    ],
    tweetIdeas: [
      `An idea is not ready until a specific person says, "I have that problem."`,
      `The first version is not the smallest app. It is the smallest proof that someone cares.`,
      `For ${audience}, the winning product might be the one that removes one weekly headache.`,
      `Do not ask "would you use this?" Ask "how do you solve this today?"`,
      `Your first pricing page is a research instrument, not a final decision.`,
      `If the landing page is hard to write, the idea is probably still too vague.`,
      `A narrow product with clear pain can beat a broad product with 100 features.`,
      `The best first feature is the one users already hacked together manually.`,
      `Distribution is easier when your build process creates useful content.`,
      `The fastest validation is a promise, a tiny ${release}, and ten honest replies.`,
    ],
    redditAngles: [
      `I am researching how ${audience} handle ${interest}; what is the most annoying part?`,
      `What tools have you tried for ${interest}, and where did they fail?`,
      `I made a free checklist for ${audience}; can you tell me what is missing?`,
      `If someone solved one part of ${interest} for you, what commitment would feel reasonable?`,
      `What advice about ${interest} sounds good online but fails in real life?`,
    ],
    seoArticleTitles: [
      `Best ${interest} tools for ${audience}`,
      `How to validate a ${interest} idea before you build`,
      `${audience}: the 7-day ${interest} testing checklist`,
      `Free template: plan your first ${interest} ${release}`,
      `Why most ${interest} tools fail beginners`,
    ],
    shockValueAngle: `Most people building for ${audience} are solving the wrong problem: they add scope before proving the weekly pain.`,
    educationalAngle: `Teach the exact validation path: pain interview -> tiny ${release} -> feedback -> next commitment.`,
    buildingInPublicAngle: `Publish each decision: the user complaint, the feature you cut, the metric you watched, and the lesson from each failed test.`,
  };
}

function audienceWord(text: string, projectType: string) {
  if (/\bstudent|school|homework|exam/i.test(text) || projectType === "Education Tool") return "students";
  if (/\bcreator|youtube|tiktok|newsletter/i.test(text)) return "creators";
  if (projectType === "Agency" || projectType === "Consulting" || projectType === "Local Business") return "clients";
  if (projectType === "Community") return "members";
  return "users";
}

function releaseWord(projectType: string, category: string) {
  if (projectType === "Education Tool" || category === "Education") return "pilot";
  if (projectType === "Agency" || projectType === "Consulting" || projectType === "Local Business") return "service offer";
  if (projectType === "Course" || projectType === "Coaching") return "pilot lesson";
  if (projectType === "Community") return "private group";
  if (projectType === "Physical Product" || projectType === "Hardware") return "prototype test";
  return "private alpha";
}
