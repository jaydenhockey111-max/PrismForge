import type { OpportunityReport, UserOpportunityInput } from "@/lib/founder-os/types";
import { createMockOpportunityReport } from "@/lib/founder-os/reportFallback";

export type OutputValueIssue =
  | "exact_restatement"
  | "high_phrase_overlap"
  | "weak_rewrite_of_strong_input"
  | "missing_decision_value";

export type OutputValueFinding = {
  field: string;
  issue: OutputValueIssue;
  overlap: number;
  action: "preserved_original" | "fallback_replaced" | "accepted";
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "helps",
  "i",
  "in",
  "into",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "turn",
  "turns",
  "with",
  "who",
  "you",
  "your",
]);

const VALUE_WORDS = /\b(recommend|priority|first|because|risk|test|evidence|proof|validate|avoid|smallest|manual|pilot|decision|tradeoff|next|measure|learn)\b/i;

export function evaluateOutputValue({
  field,
  candidate,
  rawInputs,
}: {
  field: string;
  candidate: string;
  rawInputs: string[];
}): OutputValueFinding | null {
  const text = normalize(candidate);
  if (!text) return null;
  const sources = rawInputs.map(normalize).filter(Boolean);
  const maxOverlap = Math.max(0, ...sources.map((source) => tokenOverlap(text, source)));
  const exact = sources.some((source) => source.length > 24 && source === text);

  if (exact) return { field, issue: "exact_restatement", overlap: 1, action: "accepted" };
  if (maxOverlap >= 0.78 && !VALUE_WORDS.test(candidate)) {
    return { field, issue: "high_phrase_overlap", overlap: maxOverlap, action: "accepted" };
  }
  if (field !== "summary.oneSentenceIdea" && candidate.length > 80 && !VALUE_WORDS.test(candidate)) {
    return { field, issue: "missing_decision_value", overlap: maxOverlap, action: "accepted" };
  }
  return null;
}

export function improveReportValue(report: OpportunityReport, input: UserOpportunityInput): { report: OpportunityReport; findings: OutputValueFinding[] } {
  const fallback = createMockOpportunityReport(input);
  const rawInputs = [
    input.existingIdea,
    input.targetAudience,
    input.interests,
    input.skills,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const findings: OutputValueFinding[] = [];
  const summary = { ...report.summary };
  const marketValidation = { ...report.marketValidation };
  const executionRoadmap = { ...report.executionRoadmap };

  const ideaDecision = preserveStrongOriginalIdea(input.existingIdea, summary.oneSentenceIdea);
  if (ideaDecision.preserve) {
    summary.oneSentenceIdea = ideaDecision.value;
    findings.push({ field: "summary.oneSentenceIdea", issue: "weak_rewrite_of_strong_input", overlap: ideaDecision.overlap, action: "preserved_original" });
  } else {
    const finding = evaluateOutputValue({ field: "summary.oneSentenceIdea", candidate: summary.oneSentenceIdea, rawInputs });
    if (finding?.issue === "exact_restatement" && input.existingIdea && isStrongIdea(input.existingIdea)) {
      summary.oneSentenceIdea = input.existingIdea.trim();
      findings.push({ ...finding, action: "preserved_original" });
    }
  }

  const replacements: Array<[keyof typeof summary, string, string]> = [
    ["whyNow", summary.whyNow, fallback.summary.whyNow],
    ["whyThisCouldMakeMoney", summary.whyThisCouldMakeMoney, fallback.summary.whyThisCouldMakeMoney],
    ["businessModel", summary.businessModel, fallback.summary.businessModel],
  ];

  for (const [key, candidate, fallbackValue] of replacements) {
    const finding = evaluateOutputValue({ field: `summary.${key}`, candidate, rawInputs });
    if (finding) {
      summary[key] = fallbackValue;
      findings.push({ ...finding, action: "fallback_replaced" });
    }
  }

  const underservedFinding = evaluateOutputValue({ field: "marketValidation.underservedAngle", candidate: marketValidation.underservedAngle, rawInputs });
  if (underservedFinding) {
    marketValidation.underservedAngle = fallback.marketValidation.underservedAngle;
    findings.push({ ...underservedFinding, action: "fallback_replaced" });
  }

  executionRoadmap.today = replaceLowValueList("executionRoadmap.today", executionRoadmap.today, fallback.executionRoadmap.today, rawInputs, findings);
  executionRoadmap.thisWeek = replaceLowValueList("executionRoadmap.thisWeek", executionRoadmap.thisWeek, fallback.executionRoadmap.thisWeek, rawInputs, findings);
  executionRoadmap.howToTestQuickly = replaceLowValueList("executionRoadmap.howToTestQuickly", executionRoadmap.howToTestQuickly, fallback.executionRoadmap.howToTestQuickly, rawInputs, findings);

  return {
    report: {
      ...report,
      summary,
      marketValidation,
      executionRoadmap,
    },
    findings,
  };
}

export function preserveStrongOriginalIdea(original: string | null | undefined, generated: string): { preserve: boolean; value: string; overlap: number } {
  const source = String(original ?? "").trim();
  if (!isStrongIdea(source)) return { preserve: false, value: generated, overlap: 0 };

  const overlap = tokenOverlap(generated, source);
  const generatedMechanics = importantTokens(generated);
  const sourceMechanics = importantTokens(source);
  const retainedImportantTokens = sourceMechanics.filter((token) => generatedMechanics.includes(token)).length;
  const retention = retainedImportantTokens / Math.max(1, sourceMechanics.length);
  const grammarLooksWeak = /\b(a ai|ai tool ai|problems into clear next actions|your target customer|core problem)\b/i.test(generated);
  const muchShorter = generated.length < source.length * 0.72;

  if (grammarLooksWeak || muchShorter || retention < 0.52 || (overlap > 0.74 && !VALUE_WORDS.test(generated))) {
    return { preserve: true, value: source, overlap };
  }

  return { preserve: false, value: generated, overlap };
}

function replaceLowValueList(field: string, values: string[], fallbackValues: string[], rawInputs: string[], findings: OutputValueFinding[]) {
  return values.map((value, index) => {
    const finding = evaluateOutputValue({ field: `${field}.${index}`, candidate: value, rawInputs });
    if (!finding) return value;
    findings.push({ ...finding, action: "fallback_replaced" });
    return fallbackValues[index] ?? value;
  });
}

function isStrongIdea(value: string) {
  const text = normalize(value);
  if (text.length < 60) return false;
  const hasAudience = /\b(students?|creators?|restaurants?|players?|founders?|parents?|teachers?|businesses?|teams?|users?|customers?|athletes?)\b/i.test(value);
  const hasMechanic = /\b(turns?|creates?|tracks?|reminds?|plans?|helps?|organizes?|summari[sz]es?|matches?|generates?)\b/i.test(value);
  const hasOutcome = /\b(into|so that|with|without|by)\b/i.test(value);
  return hasAudience && hasMechanic && hasOutcome;
}

function importantTokens(value: string) {
  return tokens(value).filter((token) => token.length >= 5);
}

function tokenOverlap(candidate: string, source: string) {
  const candidateTokens = new Set(tokens(candidate));
  const sourceTokens = new Set(tokens(source));
  if (!candidateTokens.size || !sourceTokens.size) return 0;
  let shared = 0;
  for (const token of candidateTokens) {
    if (sourceTokens.has(token)) shared += 1;
  }
  return shared / Math.min(candidateTokens.size, sourceTokens.size);
}

function tokens(value: string) {
  return normalize(value)
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function normalize(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
