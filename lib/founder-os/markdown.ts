import { cleanGeneratedMarkdown, cleanHeading } from "@/lib/founder-os/copyQuality";
import { BUSINESS_TYPE_LABELS, GOAL_LABELS, safeDate } from "@/lib/founder-os/helpers";
import type { OpportunityReport } from "@/lib/founder-os/types";

export function opportunityReportToMarkdown(report: OpportunityReport) {
  const lines: string[] = [];
  lines.push(`# ${cleanHeading(report.summary.title)}`);
  lines.push("");
  lines.push(`Generated: ${safeDate(report.generatedAt)}`);
  lines.push(`Business type: ${BUSINESS_TYPE_LABELS[report.input.businessType]}`);
  lines.push(`Goal: ${GOAL_LABELS[report.input.goal]}`);
  lines.push(`Project structure score: ${report.score.overall}/100`);
  lines.push("");

  lines.push("## Project Structure Score");
  for (const item of report.score.breakdown) {
    lines.push(`- **${item.label}: ${item.score}/100** — ${item.explanation}`);
  }
  lines.push("");

  lines.push("## Project Summary");
  lines.push(`- One-sentence idea: ${report.summary.oneSentenceIdea}`);
  lines.push(`- Target audience: ${report.summary.targetCustomer}`);
  lines.push(`- Problem: ${report.summary.painPoint}`);
  lines.push(`- Why now: ${report.summary.whyNow}`);
  lines.push(`- Why this could make money: ${report.summary.whyThisCouldMakeMoney}`);
  lines.push(`- Business model: ${report.summary.businessModel}`);
  lines.push("");

  lines.push("## Validation Plan");
  addList(lines, "Search assumptions", report.marketValidation.searchDemandAssumptions);
  addList(lines, "Social/content assumptions", report.marketValidation.socialDemandAssumptions);
  lines.push(`- Competitive research status: ${report.marketValidation.competitorLandscape}`);
  addList(lines, "Likely alternatives to research", report.marketValidation.existingAlternatives);
  addList(lines, "Problems to validate", report.marketValidation.userComplaints);
  lines.push(`- Underserved angle: ${report.marketValidation.underservedAngle}`);
  lines.push("");

  lines.push("## Competitive Alternatives");
  for (const competitor of report.competitors) {
    lines.push(`### ${cleanHeading(competitor.name)}`);
    lines.push(`- What they do: ${competitor.whatTheyDo}`);
    lines.push(`- Strength: ${competitor.strength}`);
    lines.push(`- Weakness: ${competitor.weakness}`);
    lines.push(`- Pricing: ${competitor.pricing}`);
    lines.push(`- Opportunity gap: ${competitor.opportunityGap}`);
    lines.push("");
  }

  lines.push("## First Version Plan");
  addList(lines, "Must-have features", report.mvpPlan.mustHaveFeatures);
  addList(lines, "Nice-to-have features", report.mvpPlan.niceToHaveFeatures);
  addList(lines, "Do not build yet", report.mvpPlan.doNotBuildYet);
  lines.push(`- Technical complexity: ${report.mvpPlan.technicalComplexity}`);
  addList(lines, "Suggested stack", report.mvpPlan.suggestedStack);
  addList(lines, "7-day build plan", report.mvpPlan.sevenDayBuildPlan);
  addList(lines, "30-day plan", report.mvpPlan.thirtyDayLaunchPlan);

  lines.push("## Monetization Plan");
  lines.push(`Suggested price: ${report.monetizationPlan.suggestedPrice}`);
  for (const tier of report.monetizationPlan.tierFeatureMap) {
    lines.push(`- ${tier.tier} (${tier.price}): ${tier.features.join(", ")}`);
  }
  lines.push(`- Upsell strategy: ${report.monetizationPlan.upsellStrategy}`);
  lines.push(`- Why users would pay: ${report.monetizationPlan.whyUsersWouldPay}`);
  lines.push("");

  lines.push("## Content Ideas");
  addList(lines, "Short-form hooks", report.contentPlan.shortFormHooks);
  addList(lines, "X/post ideas", report.contentPlan.tweetIdeas);
  addList(lines, "Reddit angles", report.contentPlan.redditAngles);
  addList(lines, "SEO article titles", report.contentPlan.seoArticleTitles);
  lines.push(`- Strong angle: ${report.contentPlan.shockValueAngle}`);
  lines.push(`- Educational angle: ${report.contentPlan.educationalAngle}`);
  lines.push(`- Build-in-public angle: ${report.contentPlan.buildingInPublicAngle}`);
  lines.push("");

  lines.push("## Landing Page Copy");
  lines.push(`- Hero headline: ${report.landingPageCopy.heroHeadline}`);
  lines.push(`- Subheadline: ${report.landingPageCopy.subheadline}`);
  lines.push(`- CTA: ${report.landingPageCopy.cta}`);
  addList(lines, "Benefit bullets", report.landingPageCopy.benefitBullets);
  lines.push(`- Proof placeholder: ${report.landingPageCopy.socialProofPlaceholder}`);
  lines.push(`- Pricing copy: ${report.landingPageCopy.pricingSectionCopy}`);
  lines.push("");

  lines.push("## Action Roadmap");
  addList(lines, "Today", report.executionRoadmap.today);
  addList(lines, "This week", report.executionRoadmap.thisWeek);
  addList(lines, "This month", report.executionRoadmap.thisMonth);
  addList(lines, "First 100 users plan", report.executionRoadmap.first100UsersPlan);
  addList(lines, "First $1,000 revenue plan", report.executionRoadmap.first1000RevenuePlan);
  addList(lines, "Biggest risks", report.executionRoadmap.biggestRisks);
  addList(lines, "How to test quickly", report.executionRoadmap.howToTestQuickly);

  return `${cleanGeneratedMarkdown(lines.join("\n")).trim()}\n`;
}

function addList(lines: string[], title: string, items: string[]) {
  lines.push(`### ${title}`);
  for (const item of items) lines.push(`- ${item}`);
  lines.push("");
}
