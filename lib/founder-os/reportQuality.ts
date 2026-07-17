import { z } from "zod";
import { detectPlaceholderAnswer } from "../input-quality/detectPlaceholderAnswer";
import { cleanGeneratedObject, validateLanguage } from "./copyQuality";
import type { OpportunityReport, UserOpportunityInput } from "./types";
import { cleanProjectTitle } from "./titleQuality";
import { sanitizeOpportunityReportTrust } from "./trustEngine";
import { validateProjectLogic } from "./logicValidator";
import { improveReportValue } from "./outputValue";

const stringArray = z.preprocess((value) => {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return Array.isArray(value) ? value.slice(0, 8) : [];
}, z.array(z.string().transform((item) => cleanText(item).slice(0, 500))).max(8));

const scoreNumber = z.coerce.number().finite().min(0).max(100);

const reportSchema = z.object({
  generatedAt: z.string().optional(),
  input: z.unknown().optional(),
  score: z.object({
    overall: scoreNumber,
    demand: scoreNumber,
    competition: scoreNumber,
    monetization: scoreNumber,
    easeOfMvp: scoreNumber,
    virality: scoreNumber,
    founderFit: scoreNumber,
    recurringRevenue: scoreNumber,
    breakdown: z.array(z.unknown()).catch([]),
  }),
  summary: z.object({
    title: cleanRequiredString(120),
    oneSentenceIdea: cleanRequiredString(600),
    targetCustomer: cleanRequiredString(300),
    painPoint: cleanRequiredString(600),
    whyNow: cleanRequiredString(600),
    whyThisCouldMakeMoney: cleanRequiredString(600),
    businessModel: cleanRequiredString(400),
  }),
  marketValidation: z.object({
    searchDemandAssumptions: stringArray,
    socialDemandAssumptions: stringArray,
    competitorLandscape: z.string().optional().catch("Alternatives and workarounds still need real-world validation."),
    existingAlternatives: stringArray,
    userComplaints: stringArray,
    underservedAngle: cleanRequiredString(600),
    confidenceNotes: stringArray,
  }),
  competitors: z.array(z.unknown()).catch([]),
  mvpPlan: z.object({
    featureList: stringArray,
    mustHaveFeatures: stringArray,
    niceToHaveFeatures: stringArray,
    doNotBuildYet: stringArray,
    technicalComplexity: z.enum(["Low", "Medium", "High"]).catch("Low"),
    suggestedStack: stringArray,
    sevenDayBuildPlan: stringArray,
    thirtyDayLaunchPlan: stringArray,
  }),
  monetizationPlan: z.object({
    freeTier: stringArray,
    premiumTier: stringArray,
    proTier: stringArray.optional(),
    suggestedPrice: cleanRequiredString(120),
    tierFeatureMap: z.array(z.unknown()).catch([]),
    upsellStrategy: cleanRequiredString(500),
    whyUsersWouldPay: cleanRequiredString(500),
  }),
  contentPlan: z.object({
    shortFormHooks: stringArray,
    videoScripts: z.array(z.unknown()).catch([]),
    tweetIdeas: stringArray,
    redditAngles: stringArray,
    seoArticleTitles: stringArray,
    shockValueAngle: cleanRequiredString(400),
    educationalAngle: cleanRequiredString(400),
    buildingInPublicAngle: cleanRequiredString(400),
  }),
  landingPageCopy: z.object({
    heroHeadline: cleanRequiredString(160),
    subheadline: cleanRequiredString(300),
    cta: cleanRequiredString(80),
    benefitBullets: stringArray,
    socialProofPlaceholder: z.string().optional().catch("No proof collected yet."),
    faq: z.array(z.unknown()).catch([]),
    pricingSectionCopy: cleanRequiredString(300),
  }),
  executionRoadmap: z.object({
    today: stringArray,
    thisWeek: stringArray,
    thisMonth: stringArray,
    first100UsersPlan: stringArray,
    first1000RevenuePlan: stringArray,
    biggestRisks: stringArray,
    howToTestQuickly: stringArray,
  }),
  generationMode: z.enum(["mock", "openai"]).catch("mock"),
  fallbackReason: z.string().optional(),
});

export type ReportValidationResult =
  | { ok: true; report: OpportunityReport; repaired: boolean; warnings: string[] }
  | { ok: false; reason: string; category: "generation_schema_error" | "generation_quality_error" };

export function validateGeneratedReport(value: unknown, input: UserOpportunityInput): ReportValidationResult {
  const parsed = reportSchema.safeParse(value);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const path = firstIssue?.path.length ? firstIssue.path.join(".") : "root";
    return { ok: false, category: "generation_schema_error", reason: `Generated report did not match the required PrismForge shape at ${path}.` };
  }

  const report = parsed.data as OpportunityReport;
  const titleRepair = cleanProjectTitle(report.summary.title, {
    audience: report.summary.targetCustomer,
    painPoint: report.summary.painPoint,
    businessType: input.businessType,
    interests: input.interests,
    existingIdea: input.existingIdea,
  });

  const normalizedBeforeTrust: OpportunityReport = {
    ...report,
    generatedAt: report.generatedAt || new Date().toISOString(),
    input,
    summary: {
      ...report.summary,
      title: titleRepair.title,
      targetCustomer: cleanText(report.summary.targetCustomer).slice(0, 500),
      painPoint: cleanText(report.summary.painPoint).slice(0, 800),
    },
    score: normalizeScore(report.score),
    generationMode: report.generationMode === "openai" ? "openai" : "mock",
  };
  const valueValidation = improveReportValue(cleanGeneratedObject(normalizedBeforeTrust), input);
  const languageBeforeTrust = valueValidation.report;
  const trustValidation = sanitizeOpportunityReportTrust(languageBeforeTrust);
  const normalized = trustValidation.report;
  const logicValidation = validateProjectLogic({ report: normalized, status: "idea" });
  const languageIssues = validateLanguage(JSON.stringify(normalizedBeforeTrust).slice(0, 10_000));

  const semanticChecks = [
    detectPlaceholderAnswer(normalized.summary.title, "idea"),
    detectPlaceholderAnswer(normalized.summary.targetCustomer, "targetAudience"),
    detectPlaceholderAnswer(normalized.summary.painPoint, "idea"),
    detectPlaceholderAnswer(normalized.summary.oneSentenceIdea, "idea"),
  ];
  const failed = semanticChecks.find((check) => check.isPlaceholder);
  if (failed) return { ok: false, category: "generation_quality_error", reason: `Generated report contained placeholder content: ${failed.reason ?? "placeholder"}.` };

  return {
    ok: true,
    report: normalized,
    repaired: titleRepair.repaired,
    warnings: [
      ...(titleRepair.repaired ? ["title_repaired"] : []),
      ...trustValidation.findings.map((finding) => `trust:${finding.category}`),
      ...logicValidation.issues.map((issue) => `logic:${issue.code}`),
      ...valueValidation.findings.map((finding) => `value:${finding.issue}:${finding.field}:${finding.action}`),
      ...languageIssues.map((issue) => `language:${issue.code}`),
    ],
  };
}

export function assertValidGeneratedReport(value: unknown, input: UserOpportunityInput) {
  const result = validateGeneratedReport(value, input);
  if (!result.ok) throw new Error(`${result.category}: ${result.reason}`);
  return result.report;
}

function cleanRequiredString(max: number) {
  return z.preprocess((value) => cleanText(value).slice(0, max), z.string().min(2).max(max));
}

function normalizeScore(score: OpportunityReport["score"]) {
  return {
    ...score,
    overall: clampScore(score.overall),
    demand: clampScore(score.demand),
    competition: clampScore(score.competition),
    monetization: clampScore(score.monetization),
    easeOfMvp: clampScore(score.easeOfMvp),
    virality: clampScore(score.virality),
    founderFit: clampScore(score.founderFit),
    recurringRevenue: clampScore(score.recurringRevenue),
    breakdown: Array.isArray(score.breakdown) ? score.breakdown : [],
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
