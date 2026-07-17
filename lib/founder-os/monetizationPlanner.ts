import type { MonetizationPlan, UserOpportunityInput } from "@/lib/founder-os/types";
import { BUSINESS_TYPE_LABELS } from "@/lib/founder-os/helpers";

export function createMonetizationPlan(input: UserOpportunityInput): MonetizationPlan {
  const price = suggestedPrice(input);
  const typeLabel = BUSINESS_TYPE_LABELS[input.businessType].toLowerCase();

  return {
    freeTier: [
      "One starter report or checklist",
      "Basic progress tracker",
      "Community/content access",
    ],
    premiumTier: [
      "Unlimited reports or workflows",
      "Export/share tools",
      "Personalized recommendations",
      "Email reminders and weekly Market Pulse summaries",
    ],
    proTier: [
      "Advanced analytics",
      "Priority generation or review",
      "Templates/swipe files",
      "Team or client-ready exports",
    ],
    suggestedPrice: price,
    tierFeatureMap: [
      { tier: "Free", price: "$0", features: ["1-3 uses/month", "Basic result", "Email capture"] },
      { tier: "Pro", price, features: ["Unlimited core usage", "Saved projects", "Exports", "Better personalization"] },
      { tier: "Founder", price: premiumPrice(input), features: ["Advanced roadmap", "Weekly monitoring", "Priority support", "Power-user workflows"] },
    ],
    upsellStrategy: `Let users get one meaningful win for free, then upsell when they want to repeat, save, export, or monitor the ${typeLabel} workflow.`,
    whyUsersWouldPay: `Users pay when the product saves time, reduces uncertainty, or helps them make money faster than free advice scattered across the internet.`,
  };
}

function suggestedPrice(input: UserOpportunityInput) {
  if (input.businessType === "local_service") return "$199-$799/project or $49/month care plan";
  if (input.businessType === "digital_product") return "$19-$49 one-time, then $9/month for updates";
  if (input.businessType === "content_business") return "$9-$19/month";
  if (input.businessType === "e_commerce") return "$19/month plus product margin";
  if (input.businessType === "ai_tool") return "$15-$29/month";
  return "$12-$29/month";
}

function premiumPrice(input: UserOpportunityInput) {
  if (input.businessType === "local_service") return "$999+/project";
  if (input.businessType === "digital_product") return "$99 bundle";
  return "$49-$99/month";
}
