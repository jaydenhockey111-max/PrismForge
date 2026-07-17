import type { BusinessType, UserOpportunityInput } from "./types";

export type ProjectTitleContext = {
  audience?: string | null;
  painPoint?: string | null;
  businessType?: BusinessType | string | null;
  interests?: string | null;
  skills?: string | null;
  existingIdea?: string | null;
  outcome?: string | null;
  coreConcept?: string | null;
};

export type ProjectTitleRepair = {
  title: string;
  repaired: boolean;
  reason?: string;
  source?: "stored" | "generated" | "fallback" | "legacy_repaired" | "user";
};

export type ProjectTitleValidation = {
  valid: boolean;
  normalizedTitle: string;
  reason?: string;
};

const TITLE_MAX_LENGTH = 64;
const TITLE_MAX_WORDS = 8;

const EXACT_WEAK_TITLES = new Set([
  "untitled",
  "new project",
  "my project",
  "my startup",
  "startup",
  "business",
  "app",
  "platform",
  "website",
  "idea",
  "test",
  "testing",
  "demo",
  "sample",
  "project",
  "project 1",
  "no idea",
  "no clue",
  "idk",
  "whatever",
  "anything",
  "something",
  "placeholder",
  "tbd",
  "to be determined",
  "n/a",
  "na",
  "none",
  "i want to create a",
  "i want to build a",
  "i want to make a",
  "create a",
  "build a",
  "make a",
  "an app for",
  "a business for",
  "a tool for",
]);

const TERMINAL_WEAK_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "with",
  "of",
  "and",
  "or",
  "that",
  "who",
  "helps",
  "help",
  "create",
  "build",
  "make",
]);

const LEADING_PROMPT_PATTERNS: RegExp[] = [
  /^(?:could\s+you\s+)?(?:please\s+)?(?:give\s+me\s+)?(?:blunt\s+)?feedback\s+on\s+/i,
  /^(?:can\s+you\s+)?(?:help\s+me\s+)?(?:create|build|make|launch|start)\s+(?:me\s+)?(?:a|an|the)?\s*/i,
  /^(?:i\s+want\s+to|i\s+would\s+like\s+to|i'd\s+like\s+to|i\s+am\s+trying\s+to|i'm\s+trying\s+to|we\s+want\s+to)\s+/i,
  /^(?:i\s+am\s+building|i'm\s+building|i\s+am\s+making|i'm\s+making|i\s+am\s+creating|i'm\s+creating)\s+(?:a|an|the)?\s*/i,
  /^(?:my\s+idea\s+is\s+to|my\s+idea\s+is|my\s+project\s+is|the\s+idea\s+is\s+to|the\s+idea\s+is|idea\s*:?)\s+/i,
  /^(?:something\s+that|something\s+to)\s+/i,
];

const CONTAINER_PREFIX_PATTERNS: Array<{ pattern: RegExp; suffix?: string }> = [
  { pattern: /^(?:an?|the)\s+app\s+for\s+/i, suffix: "App" },
  { pattern: /^(?:an?|the)\s+application\s+for\s+/i, suffix: "App" },
  { pattern: /^(?:an?|the)\s+platform\s+for\s+/i, suffix: "Platform" },
  { pattern: /^(?:an?|the)\s+tool\s+for\s+/i, suffix: "Tool" },
  { pattern: /^(?:an?|the)\s+service\s+for\s+/i, suffix: "Service" },
  { pattern: /^(?:an?|the)\s+business\s+for\s+/i, suffix: "Business" },
  { pattern: /^(?:an?|the)\s+website\s+for\s+/i, suffix: "Website" },
];

const WEAK_SENTENCE_PATTERNS: RegExp[] = [
  /\bturn\s+chaos\s+into\s+clarity\b/i,
  /\bwhat\s+felt\s+useful\b/i,
  /\bwhat\s+was\s+confusing\b/i,
  /\bwhat\s+broke\b/i,
  /\bnot\s+worth\s+paying\s+for\b/i,
  /\bplease\s+answer\s+all\s+questions\b/i,
  /\bgoogle\s+forms?\b/i,
  /\btypeform\b/i,
];

const ACRONYMS = new Map([
  ["ai", "AI"],
  ["api", "API"],
  ["b2b", "B2B"],
  ["b2c", "B2C"],
  ["crm", "CRM"],
  ["mvp", "MVP"],
  ["seo", "SEO"],
  ["saas", "SaaS"],
  ["ios", "iOS"],
  ["ui", "UI"],
  ["ux", "UX"],
]);

export function cleanProjectTitle(rawTitle: string | null | undefined, context: ProjectTitleContext = {}): ProjectTitleRepair {
  return normalizeProjectTitle(rawTitle, context);
}

export function normalizeProjectTitle(rawTitle: string | null | undefined, context: ProjectTitleContext = {}): ProjectTitleRepair {
  const original = normalizeTitle(rawTitle ?? "");
  const candidate = buildCandidateTitle(original);
  const validation = validateProjectTitle(candidate);

  if (validation.valid) {
    return {
      title: validation.normalizedTitle,
      repaired: validation.normalizedTitle !== original,
      reason: validation.normalizedTitle !== original ? "Cleaned founder phrase from title." : undefined,
      source: validation.normalizedTitle !== original ? "legacy_repaired" : "stored",
    };
  }

  const fallback = deriveFallbackProjectTitle(context);
  return {
    title: fallback,
    repaired: true,
    reason: validation.reason ?? (candidate ? "Replaced weak or unfinished project title." : "Generated missing project title."),
    source: "fallback",
  };
}

export function validateProjectTitle(title: string | null | undefined): ProjectTitleValidation {
  const rawTitle = normalizeTitle(title ?? "");
  if (rawTitle && (LEADING_PROMPT_PATTERNS.some((pattern) => pattern.test(rawTitle)) || WEAK_SENTENCE_PATTERNS.some((pattern) => pattern.test(rawTitle)))) {
    return { valid: false, normalizedTitle: buildCandidateTitle(rawTitle), reason: "Title looks like copied prompt text." };
  }
  const normalizedTitle = shortenTitle(buildCandidateTitle(title ?? ""));
  const comparable = comparableTitle(normalizedTitle);
  const words = normalizedTitle.split(/\s+/).filter(Boolean);

  if (!normalizedTitle) return { valid: false, normalizedTitle, reason: "Title is missing." };
  if (normalizedTitle.length < 4) return { valid: false, normalizedTitle, reason: "Title is too short." };
  if (normalizedTitle.length > TITLE_MAX_LENGTH) return { valid: false, normalizedTitle, reason: "Title is too long." };
  if (words.length > TITLE_MAX_WORDS) return { valid: false, normalizedTitle, reason: "Title is too sentence-like." };
  if (EXACT_WEAK_TITLES.has(comparable)) return { valid: false, normalizedTitle, reason: "Title is a placeholder." };
  if (/^[^\p{L}\p{N}]+$/u.test(normalizedTitle)) return { valid: false, normalizedTitle, reason: "Title has no readable words." };
  if (/([a-z])\1{4,}/i.test(normalizedTitle)) return { valid: false, normalizedTitle, reason: "Title has repeated characters." };
  if (WEAK_SENTENCE_PATTERNS.some((pattern) => pattern.test(normalizedTitle))) return { valid: false, normalizedTitle, reason: "Title looks like copied prompt text." };
  if (LEADING_PROMPT_PATTERNS.some((pattern) => pattern.test(normalizedTitle))) return { valid: false, normalizedTitle, reason: "Title starts with onboarding text." };
  if (words.length > 3 && /\b(that|because|when|while|where|helps?|turns?|allows?|gives?|solves?|creates?)\b/i.test(normalizedTitle)) {
    return { valid: false, normalizedTitle, reason: "Title is a sentence, not a project name." };
  }

  const lastWord = words.at(-1)?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  if (TERMINAL_WEAK_WORDS.has(lastWord)) return { valid: false, normalizedTitle, reason: "Title ends mid-thought." };

  const meaningfulWords = words.filter((word) => !TERMINAL_WEAK_WORDS.has(word.toLowerCase().replace(/[^a-z]/g, "")));
  if (meaningfulWords.length === 0) return { valid: false, normalizedTitle, reason: "Title only contains filler words." };

  return { valid: true, normalizedTitle };
}

export function deriveFallbackProjectTitle(context: ProjectTitleContext = {}) {
  const combined = normalizeText([
    context.coreConcept,
    context.existingIdea,
    context.audience,
    context.painPoint,
    context.outcome,
    context.interests,
    context.skills,
    context.businessType,
  ].filter(Boolean).join(" "));

  const keywordTitle = keywordFallbackTitle(combined);
  if (keywordTitle) return keywordTitle;

  const audience = audienceNoun(context.audience ?? combined);
  const noun = productNoun(context.businessType ?? undefined);
  return titleCase(`${audience} ${noun}`);
}

export function fallbackProjectTitle(context: ProjectTitleContext = {}) {
  return deriveFallbackProjectTitle(context);
}

export function getSafeDisplayProjectTitle(project: {
  title?: string | null;
  business_type?: BusinessType | string | null;
  target_customer?: string | null;
  report_json?: unknown;
}) {
  const report = parseReportLike(project.report_json);
  return normalizeProjectTitle(project.title ?? report.title, {
    audience: project.target_customer ?? report.audience,
    painPoint: report.painPoint,
    businessType: project.business_type ?? report.businessType,
    interests: report.interests,
    skills: report.skills,
    existingIdea: report.existingIdea,
    outcome: report.outcome,
    coreConcept: report.title,
  }).title;
}

export function projectTitleFromInput(input: UserOpportunityInput) {
  return normalizeProjectTitle(input.existingIdea, {
    audience: input.targetAudience,
    businessType: input.businessType,
    interests: input.interests,
    skills: input.skills,
    existingIdea: input.existingIdea,
  }).title;
}

export function isWeakProjectTitle(title: string | null | undefined) {
  return !validateProjectTitle(title).valid;
}

function buildCandidateTitle(rawValue: string) {
  let value = normalizeTitle(rawValue);
  if (!value) return "";

  value = value.replace(/^["'`]+|["'`]+$/g, "").trim();

  for (let index = 0; index < 3; index += 1) {
    const before = value;
    for (const pattern of LEADING_PROMPT_PATTERNS) {
      value = value.replace(pattern, "").trim();
    }

    for (const container of CONTAINER_PREFIX_PATTERNS) {
      if (container.pattern.test(value)) {
        value = value.replace(container.pattern, "").trim();
        if (container.suffix && value && !new RegExp(`\\b${container.suffix}\\b$`, "i").test(value)) value = `${value} ${container.suffix}`;
        break;
      }
    }

    value = value
      .replace(/^(?:a|an|the)\s+(?=\w+\s+\w+)/i, "")
      .replace(/\b(?:please|thanks|thank\s+you)\b[.!?]*$/i, "")
      .trim();
    if (value === before) break;
  }

  return shortenTitle(value);
}

function shortenTitle(value: string) {
  const withoutClause = normalizeTitle(value)
    .replace(/\s+(that|which|who)\s+(helps?|turns?|lets?|allows?|gives?|makes?|solves?|creates?|uses?)\b[\s\S]*$/i, "")
    .replace(/\s+(for|to)\s+(high school students|middle school students|students|founders|creators|parents|teachers|freelancers|small businesses|teams)\b[\s\S]*$/i, "")
    .replace(/\s*[-:;]\s*(?:for|to|that|which|because)\b[\s\S]*$/i, "")
    .replace(/[?!.]+$/g, "")
    .replace(/\s*[:;]\s*[\s\S]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = withoutClause.split(/\s+/).filter(Boolean);
  const compact = words.length > TITLE_MAX_WORDS ? words.slice(0, TITLE_MAX_WORDS).join(" ") : withoutClause;
  return titleCase(compact).slice(0, TITLE_MAX_LENGTH).trim();
}

function keywordFallbackTitle(value: string) {
  const rules: Array<[RegExp, string]> = [
    [/\b(golf|golfer|swing|putting|driving range)\b/i, "Golf Practice Planner"],
    [/\b(freelance|freelancer|invoice|invoicing|client payment)\b/i, "Freelance Invoice Tracker"],
    [/\b(tutor|tutoring|mentor|homework help)\b/i, "Student Tutoring Marketplace"],
    [/\b(meal|family dinner|recipes?|grocery|nutrition)\b/i, "Family Meal Planning Service"],
    [/\b(creators?|sponsors?|sponsorship|brand deals?|influencers?)\b/i, "Creator Sponsorship Toolkit"],
    [/\b(study|homework|notes?|weak topics?|exam|school|student|class)\b/i, "Student Study Coach"],
    [/\b(hockey|athlete|sports?|training|practice|coach)\b/i, "Athlete Training Planner"],
    [/\b(fitness|gym|workout)\b/i, "Fitness Progress Coach"],
    [/\b(budget|money|finance|saving|spending)\b/i, "Money Clarity Planner"],
    [/\b(local|restaurant|salon|repair|service|neighborhood)\b/i, "Local Service Concept"],
    [/\b(shop|store|ecommerce|e-commerce|product|merch)\b/i, "Niche Storefront Builder"],
    [/\b(startups?|founders?|business|entrepreneurs?|saas)\b/i, "Founder Launch Workspace"],
  ];

  return rules.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

function audienceNoun(value: string) {
  const normalized = normalizeText(value);
  if (/\bstudent|school|college|teen\b/.test(normalized)) return "Student";
  if (/\bfounder|startup|entrepreneur\b/.test(normalized)) return "Founder";
  if (/\bcreator|influencer|youtuber|tiktok\b/.test(normalized)) return "Creator";
  if (/\bparent|family\b/.test(normalized)) return "Family";
  if (/\bteacher|coach\b/.test(normalized)) return "Coach";
  if (/\bsmall business|owner|local\b/.test(normalized)) return "Business";
  if (/\bfreelancer|consultant\b/.test(normalized)) return "Freelancer";
  return "Niche";
}

function productNoun(type?: BusinessType | string | null) {
  if (type === "ai_tool") return "AI Assistant";
  if (type === "digital_product") return "Playbook";
  if (type === "local_service") return "Service";
  if (type === "content_business") return "Media Engine";
  if (type === "e_commerce") return "Storefront";
  return "Workspace";
}

function normalizeTitle(value: string) {
  return value
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[-_/]+/g, " ")
    .replace(/([!?.,])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function comparableTitle(value: string) {
  return normalizeText(value).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  const lowercaseWords = new Set(["for", "and", "or", "of", "to", "with", "in", "on"]);
  return normalizeTitle(value)
    .split(" ")
    .map((word, index) => {
      const cleaned = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (!cleaned) return "";
      const lower = cleaned.toLowerCase();
      if (ACRONYMS.has(lower)) return ACRONYMS.get(lower)!;
      if (index > 0 && lowercaseWords.has(lower)) return lower;
      if (/^[A-Z0-9]{2,}$/.test(cleaned)) return cleaned;
      if (/^[A-Z][a-z]+[A-Z][A-Za-z]*$/.test(cleaned)) return cleaned;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .filter(Boolean)
    .join(" ");
}

function normalizeText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseReportLike(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const report = value as {
    summary?: { title?: unknown; targetCustomer?: unknown; painPoint?: unknown; oneSentenceIdea?: unknown };
    input?: { existingIdea?: unknown; interests?: unknown; skills?: unknown; businessType?: unknown; targetAudience?: unknown };
    monetization?: { revenueModel?: unknown };
  };
  return {
    title: asString(report.summary?.title),
    audience: asString(report.summary?.targetCustomer) ?? asString(report.input?.targetAudience),
    painPoint: asString(report.summary?.painPoint) ?? asString(report.summary?.oneSentenceIdea),
    businessType: asString(report.input?.businessType),
    interests: asString(report.input?.interests),
    skills: asString(report.input?.skills),
    existingIdea: asString(report.input?.existingIdea),
    outcome: asString(report.monetization?.revenueModel),
  };
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
