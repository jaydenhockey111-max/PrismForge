import type { MarketValidation, UserOpportunityInput } from "@/lib/founder-os/types";
import { BUSINESS_TYPE_LABELS, compactList, firstInterest, productNoun } from "@/lib/founder-os/helpers";

export function createMarketValidation(input: UserOpportunityInput): MarketValidation {
  const interests = compactList(input.interests);
  const interest = firstInterest(input);
  const typeLabel = BUSINESS_TYPE_LABELS[input.businessType].toLowerCase();
  const audience = input.targetAudience;

  return {
    searchDemandAssumptions: [
      `"best tools for ${audience}" and "${interest} templates" are likely long-tail searches worth testing.`,
      `People searching for "how to ${interest}" often want a faster path, not another generic article.`,
      `Landing page SEO can start with pain-aware pages like "${audience} ${interest} workflow" before broad keywords.`,
    ],
    socialDemandAssumptions: [
      `TikTok/Reels can show the before/after transformation: messy workflow to clean ${productNoun(input)}.`,
      `Reddit validation should focus on asking for pain, not pitching. The first useful post is a teardown or checklist.`,
      `YouTube Shorts can work if each clip solves one tiny problem for ${audience}.`,
    ],
    competitorLandscape: `${typeLabel} markets usually have broad incumbents. The opening is a narrower, opinionated product for ${audience}.`,
    existingAlternatives: [
      "Generic spreadsheets and Notion templates",
      "Large all-in-one tools with too many features",
      "Manual agency or freelancer workflows",
      ...interests.slice(0, 2).map((item) => `${item} communities sharing ad-hoc advice`),
    ],
    userComplaints: [
      "Hypothesis to validate in interviews: the target customer sees too much advice and not enough step-by-step execution.",
      "Hypothesis to validate in interviews: existing tools may feel built for experts instead of beginners.",
      "Hypothesis to validate in interviews: static templates may not adapt well enough to the user's situation.",
      "Hypothesis to validate in interviews: the target customer may not know what to do next after they get an idea.",
    ],
    underservedAngle: `Be the simplest launch companion for ${audience}: one focused path from idea to first paying signal.`,
    confidenceNotes: [
      "This is a validation-ready mock demand layer; real search/social APIs can replace these assumptions later.",
      "The strongest next test is 10 customer conversations plus a one-page waitlist.",
      "Demand should be considered unproven until users join, reply, or pay.",
    ],
  };
}
