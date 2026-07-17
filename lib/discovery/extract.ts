import { createHash } from "node:crypto";
import { INTERESTS, STUDENT_STATUSES, US_STATES } from "../constants";
import type { EligibilityRules, OpportunityCategory } from "../database.types";
import { cleanText, inferInterests } from "../ingestion/connectors/grants-gov";
import type { ExtractedWebOpportunity, SearchResult } from "./types";

type RegistryRule = { domain: string; trust_level: "official" | "trusted" | "unverified" | "blocked"; auto_publish: boolean };

export function extractWebOpportunity(result: SearchResult, registry: RegistryRule[] = []): ExtractedWebOpportunity {
  const domain = new URL(result.url).hostname.toLowerCase();
  const sourceRule = registry.find((rule) => domain === rule.domain || domain.endsWith(`.${rule.domain}`));
  const trustLevel = sourceRule?.trust_level ?? inferDomainTrust(domain);
  const content = normalizeWebContent(result.rawContent || result.snippet);
  const title = cleanText(result.title).slice(0, 160);
  const searchableText = `${title}\n${result.snippet}\n${content}`;
  const category = inferCategory(searchableText);
  const deadline = inferDeadline(searchableText);
  const eligibilitySummary = inferEligibilitySummary(content);
  const eligibilityRules = inferEligibilityRules(`${title}\n${content}`);
  const description = buildDescription(content, result.snippet, title);
  const hasApplicationSignal = /\b(apply|application|applications|applicant|eligib|deadline|due date|closing date|apply by)\b/i.test(searchableText);
  const hasSpecificOpportunitySignal = hasSpecificOpportunity(title, result.url, content);

  let confidence = 0;
  if (trustLevel === "official") confidence += 25;
  else if (trustLevel === "trusted") confidence += 15;
  if (title.length >= 12) confidence += 10;
  if (category) confidence += 10;
  if (deadline && deadline >= today()) confidence += 20;
  if (description.length >= 100) confidence += 10;
  if (hasApplicationSignal) confidence += 10;
  if (eligibilitySummary) confidence += 10;
  if (content.length >= 500) confidence += 5;
  if (hasSpecificOpportunitySignal) confidence += 5;
  confidence = Math.min(100, confidence);

  const trustedForPublishing = trustLevel === "official" || (trustLevel === "trusted" && sourceRule?.auto_publish === true);
  const highConfidenceAllowed = confidence >= 85 && trustLevel !== "blocked" && !!category && (!deadline || deadline >= today());
  const strictAutoPublish = trustedForPublishing && confidence >= 85 && !!category && !!deadline && deadline >= today() && hasSpecificOpportunitySignal;
  const autoPublish = highConfidenceAllowed || strictAutoPublish;
  const statusReason = trustLevel === "blocked" ? "Blocked source domain"
    : !category ? "Opportunity category could not be determined"
    : deadline && deadline < today() ? "The detected deadline has passed"
    : confidence >= 85 ? "High-confidence candidate auto-published"
    : !trustedForPublishing ? "Source is not approved for automatic publishing"
    : !deadline ? "A future application deadline was not found"
    : !hasSpecificOpportunitySignal ? "Page looks too broad for automatic publishing"
    : confidence < 85 ? `Confidence ${confidence} is below the automatic-publish threshold`
    : "High-confidence opportunity from an approved source";

  return {
    title, description, category, deadline, eligibilityRules, eligibilitySummary,
    confidence, trustLevel, autoPublish, statusReason,
    extraction: { domain, content_hash: contentHash(content), application_signal: hasApplicationSignal },
  };
}

function hasSpecificOpportunity(title: string, url: string, content: string) {
  const combined = `${title}\n${url}\n${content.slice(0, 2500)}`.toLowerCase();
  const titleText = title.toLowerCase();
  const tooGenericTitle = /^(opportunities|grants|programs|startup programs|founder programs|funding opportunities)(\s*[-|:].*)?$/i.test(title.trim())
    || title.length > 140;
  if (tooGenericTitle) return false;

  const opportunityWord = /\b(startup|entrepreneur|founder|small business|accelerator|incubator|grant|rebate|tax credit|fellowship|hackathon|competition|challenge|contest|award|prize|pitch)\b/.test(combined);
  const actionWord = /\b(apply|application|applications|deadline|due date|closing date|eligible|eligibility|applicants?|submission|submit)\b/.test(combined);
  const titleOrUrlSpecific = /\b(startup|entrepreneur|founder|small-business|small business|accelerator|incubator|grant|rebate|fellowship|hackathon|competition|challenge|contest|award|prize|pitch|apply|application)\b/.test(`${titleText}\n${url.toLowerCase()}`);

  return opportunityWord && actionWord && titleOrUrlSpecific;
}

export function inferDomainTrust(domain: string): "official" | "unverified" {
  return domain.endsWith(".gov") || domain.endsWith(".mil") || domain.endsWith(".edu") ? "official" : "unverified";
}

export function inferCategory(value: string): OpportunityCategory | null {
  const text = value.toLowerCase();
  if (/\b(hackathon|buildathon|codeathon)\b/.test(text)) return "hackathon";
  if (/\b(accelerator|incubator|cohort|venture studio)\b/.test(text)) return "accelerator";
  if (/\b(founder fellowship|entrepreneur fellowship|startup fellowship|student founder program)\b/.test(text)) return "founder_fellowship";
  if (/\b(pitch competition|startup competition|business plan competition|demo day|challenge|contest|prize)\b/.test(text)) return "pitch_competition";
  if (/\b(rebate|tax credit|tax incentive|small business incentive)\b/.test(text)) return "small_business_rebate";
  if (/\b(startup grant|small business grant|entrepreneur grant|innovation grant|funding opportunity|notice of funding|grant)\b/.test(text)) return "startup_grant";
  return null;
}

export function inferDeadline(value: string) {
  const normalized = cleanText(value).replace(/\bSept\b/gi, "Sep").replace(/[–—−]/g, "-");
  const keywordPattern = /(?:application\s+)?(?:deadline|due date|closing date|close date|closes?|applications?\s+(?:are\s+)?(?:due|close)|apply by|submission deadline|submissions?\s+(?:are\s+)?due|priority deadline)/gi;
  const contexts = Array.from(normalized.matchAll(keywordPattern)).flatMap((match) => {
    const index = match.index ?? 0;
    return [
      normalized.slice(index, index + 240),
      normalized.slice(Math.max(0, index - 90), index + 180),
    ];
  });
  for (const context of contexts) {
    const date = findDate(context);
    if (date && date >= today() && date <= futureLimit()) return date;
  }
  return null;
}

function findDate(value: string) {
  const patterns = [
    /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/,
    /\b(20\d{2})\/(\d{1,2})\/(\d{1,2})\b/,
    /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/,
    /\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[.]?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i,
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const timestamp = Date.parse(match[0].replace(/(st|nd|rd|th)/i, ""));
    if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString().slice(0, 10);
  }
  return null;
}

function inferEligibilityRules(value: string): EligibilityRules {
  const text = value.toLowerCase();
  const rules: EligibilityRules = {};
  const interests = inferInterests(value).filter((interest) => INTERESTS.includes(interest));
  if (interests.length) rules.interests = interests;

  const statuses = STUDENT_STATUSES.flatMap(([status]) => {
    const terms: Record<string, string[]> = {
      high_school: ["high school", "secondary school"], undergraduate: ["undergraduate", "college student"],
      graduate: ["graduate student", "master's student", "doctoral student", "phd student"],
      vocational: ["vocational", "trade school", "technical school"], not_student: [],
    };
    return terms[status]?.some((term) => text.includes(term)) ? [status] : [];
  });
  if (statuses.length) rules.student_statuses = statuses;

  const ageRange = text.match(/\bages?\s+(\d{1,3})\s*(?:-|to|through)\s*(\d{1,3})\b/);
  const maxAge = text.match(/\b(?:age\s+)?(\d{1,3})\s+or younger\b|\bunder\s+(?:age\s+)?(\d{1,3})\b/);
  const minAge = text.match(/\b(?:at least|minimum age(?: of)?)\s+(\d{1,3})\b/);
  if (ageRange) { rules.min_age = Number(ageRange[1]); rules.max_age = Number(ageRange[2]); }
  else {
    if (maxAge) rules.max_age = Number(maxAge[1] ?? maxAge[2]) - (maxAge[2] ? 1 : 0);
    if (minAge) rules.min_age = Number(minAge[1]);
  }

  const states = US_STATES.flatMap(([code, name]) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:resident|residents|residency)\\s+(?:of|in)\\s+(?:the\\s+)?${escaped}\\b`, "i").test(value) ? [code] : [];
  });
  if (states.length) rules.states = states;

  const businessTypes = [
    ["ai_tool", [" ai ", "artificial intelligence", "machine learning", "automation"]],
    ["saas", ["saas", "software", "platform", "web app"]],
    ["digital_product", ["digital product", "template", "course", "ebook"]],
    ["local_service", ["local business", "service business", "main street"]],
    ["content_business", ["creator", "media", "newsletter", "content"]],
    ["e_commerce", ["ecommerce", "e-commerce", "retail", "storefront"]],
  ] as const;
  const inferredBusinessTypes = businessTypes.flatMap(([type, keywords]) => keywords.some((keyword) => text.includes(keyword)) ? [type] : []);
  if (inferredBusinessTypes.length) rules.business_types = inferredBusinessTypes;

  const targetKeywords = ["ai", "climate", "student", "education", "health", "fintech", "local", "small business", "creator", "software", "social impact", "hardware"]
    .filter((keyword) => text.includes(keyword));
  if (targetKeywords.length) rules.target_keywords = [...new Set(targetKeywords)];

  return rules;
}

function inferEligibilitySummary(value: string) {
  const sentences = value.split(/(?<=[.!?])\s+/).filter((sentence) => /\b(eligib|applicant|must be|resident|students?|age|income)\b/i.test(sentence));
  const summary = sentences.slice(0, 5).join(" ").trim();
  return summary ? summary.slice(0, 2000) : null;
}

function normalizeWebContent(value: string) {
  return cleanText(value.replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")).slice(0, 20_000);
}

function buildDescription(content: string, snippet: string, title: string) {
  const source = content.length >= 80 ? content : cleanText(snippet);
  const description = source.slice(0, 2500).trim();
  return description.length >= 20 ? description : `${title} is an opportunity discovered on an official source website. Review the linked source for full details.`;
}

export function contentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function today() { return new Date().toISOString().slice(0, 10); }
function futureLimit() { const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() + 3); return date.toISOString().slice(0, 10); }
