import type { Competitor, UserOpportunityInput } from "@/lib/founder-os/types";
import { BUSINESS_TYPE_LABELS, firstInterest, productNoun, titleCase } from "@/lib/founder-os/helpers";

export function analyzeCompetitors(input: UserOpportunityInput): Competitor[] {
  const interest = titleCase(firstInterest(input));
  const audience = input.targetAudience || "your audience";
  const type = BUSINESS_TYPE_LABELS[input.businessType];

  return [
    {
      name: `${interest} Template Sellers`,
      whatTheyDo: `Sell static downloads, checklists, and spreadsheets for people interested in ${interest}.`,
      strength: "Fast to understand and cheap to buy.",
      weakness: "Users still have to do the hard thinking and keep themselves accountable.",
      pricing: "$9-$49 one-time",
      opportunityGap: `Turn static advice into an adaptive ${productNoun(input)} with progress tracking.`,
    },
    {
      name: `All-in-one ${type} Platforms`,
      whatTheyDo: `Offer broad tooling that can technically serve ${audience}, but is not designed around their exact pain.`,
      strength: "Feature-rich and trusted.",
      weakness: "Too complex for users who want a focused path and fast launch plan.",
      pricing: "$12-$99/month",
      opportunityGap: "Win by being narrower, friendlier, and more outcome-driven.",
    },
    {
      name: "Coaches, agencies, and consultants",
      whatTheyDo: `Help ${audience} solve the problem manually through calls, audits, and custom work.`,
      strength: "High-touch support and personalized advice.",
      weakness: "Expensive, hard to scale, and inconsistent quality.",
      pricing: "$500-$5,000+",
      opportunityGap: "Productize the first 60% of the work at a price beginners can afford.",
    },
  ];
}
