import { cleanProjectTitle } from "./titleQuality";

export type LanguageIssueCode =
  | "broken_article"
  | "duplicate_phrase"
  | "repeated_punctuation"
  | "plain_english_rewrite"
  | "truncated_output"
  | "ai_sounding_phrase";

export type LanguageIssue = {
  code: LanguageIssueCode;
  before: string;
  after: string;
};

export const PLAIN_ENGLISH_TERMS: Record<string, string> = {
  "confirm pain": "validate the problem",
  "validation signal": "evidence collected",
  "hypothesis confidence": "how confident are you?",
  "customer discovery": "talk to potential users",
  "go-to-market": "launch plan",
  "growth hacking": "growth experiments",
  leverage: "use",
  synergy: "fit",
  revolutionize: "improve",
  ecosystem: "system",
  traction: "early progress",
  "market fit": "people want this",
};

const AI_CLICHES: Array<[RegExp, string]> = [
  [/\bempowers?\s+users?\s+to\s+leverage\b/gi, "helps users use"],
  [/\bleverage\b/gi, "use"],
  [/\bsynergy\b/gi, "fit"],
  [/\brevolutionize\b/gi, "improve"],
  [/\bseamlessly\b/gi, ""],
  [/\bcutting-edge\b/gi, "modern"],
  [/\bgame-changing\b/gi, "useful"],
];

const MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[â€œâ€]/g, "\""],
  [/[â€˜â€™]/g, "'"],
  [/[â€“â€”]/g, "-"],
  [/â†’/g, "->"],
  [/Â·/g, "·"],
  [/â€¢/g, "•"],
  [/â€¦/g, "..."],
];

const TRUNCATED_ENDING = /\b(?:a|an|and|or|the|to|for|with|that|which|who|t|stu|mar|pro|val)$/i;
const ACRONYM_PATTERN = /\b(ai|api|b2b|b2c|crm|mvp|seo|ui|ux|saas|ios)\b/gi;

export function cleanGeneratedCopy(value: string, options: { maxLength?: number; heading?: boolean } | number = {}) {
  const config = typeof options === "number" ? {} : options;
  const original = String(value ?? "");
  let output = original;
  for (const [pattern, replacement] of MOJIBAKE_REPLACEMENTS) output = output.replace(pattern, replacement);

  output = output
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:)])/g, "$1")
    .replace(/([({[])\s+/g, "$1")
    .replace(/([,.!?;:])([^\s"')\]])/g, "$1 $2")
    .replace(/([!?.,]){2,}/g, "$1")
    .replace(/\bplanning\.\./gi, "planning.")
    .replace(/\bI['’]?m building\s+I\s+want\s+to\s+create\s+an?\b/gi, "I'm exploring")
    .replace(/\b(an?)\s+AI\s+tool\s+AI\s+assistant\b/gi, "an AI assistant")
    .replace(/\bA\s+AI\b/g, "An AI")
    .replace(/\ba\s+AI\b/g, "an AI")
    .replace(/\bAn\s+(?:a|an)\b/gi, "An")
    .replace(/\bA\s+(?:a|an)\b/gi, "A")
    .replace(/\bAI\s+AI\b/g, "AI")
    .replace(/\btool\s+tool\b/gi, "tool")
    .replace(/\bapp\s+app\b/gi, "app")
    .replace(/\bproject\s+project\b/gi, "project")
    .replace(/\b(founders?|students?|users?|creators?|clients?|members?)\s+\1\b/gi, "$1")
    .replace(/\b(high school students)\s+\1\b/gi, "$1")
    .replace(/\bturn\s+AI\s+tools\s+problems\b/gi, "turn scattered AI tool problems")
    .trim();

  output = applyPlainEnglish(output);
  output = applyAiClicheCleanup(output);
  output = fixArticles(output);
  output = dedupeAdjacentPhrases(output);
  output = normalizeAcronyms(output);
  output = normalizeSentenceCapitalization(output, config.heading);

  if (config.heading) output = cleanHeading(output);
  if (config.maxLength) output = truncateCleanly(output, config.maxLength);
  const ending = original.trim().match(/[.!?]$/)?.[0];
  if (ending && !/[.!?]$/.test(output)) output = `${output}${ending}`;
  return output.trim();
}

export function cleanHeading(value: string, maxLength = 96) {
  let output = cleanGeneratedCopy(value)
    .replace(/^#+\s*/, "")
    .replace(/\s*[:;-]\s*$/g, "")
    .replace(TRUNCATED_ENDING, "")
    .trim();
  output = truncateCleanly(output, maxLength);
  return output || "Project";
}

export function cleanGeneratedMarkdown(value: string, options: { maxLength?: number } = {}) {
  const lines = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const prefix = line.match(/^(\s*(?:[-*]|\d+\.|#{1,6})\s+)/)?.[1] ?? "";
      const body = prefix ? line.slice(prefix.length) : line;
      return `${prefix}${cleanGeneratedCopy(body)}`.trimEnd();
    });
  const compact = lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
  return options.maxLength ? truncateCleanly(compact, options.maxLength) : compact;
}

export function cleanOutputLength(value: string, maxLength: number) {
  return truncateCleanly(cleanGeneratedCopy(value), maxLength);
}

export function cleanGeneratedList(values: string[], options: { maxItems?: number; maxLength?: number; heading?: boolean } = {}) {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const value of values) {
    const item = cleanGeneratedCopy(value, options);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(item);
    if (options.maxItems && cleaned.length >= options.maxItems) break;
  }
  return cleaned;
}

export function cleanGeneratedObject<T>(value: T): T {
  if (typeof value === "string") return cleanGeneratedCopy(value) as T;
  if (Array.isArray(value)) return value.map((item) => cleanGeneratedObject(item)) as T;
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) output[key] = cleanGeneratedObject(nested);
  return output as T;
}

export function validateLanguage(value: string): LanguageIssue[] {
  const cleaned = cleanGeneratedCopy(value);
  const issues: LanguageIssue[] = [];
  const raw = String(value ?? "");
  if (/\bA\s+AI\b|\ba\s+AI\b/.test(raw)) issues.push({ code: "broken_article", before: raw, after: cleaned });
  if (/\b(\w+(?:\s+\w+){0,3})\s+\1\b/i.test(raw)) issues.push({ code: "duplicate_phrase", before: raw, after: cleaned });
  if (/([!?.,]){2,}/.test(raw)) issues.push({ code: "repeated_punctuation", before: raw, after: cleaned });
  if (Object.keys(PLAIN_ENGLISH_TERMS).some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(raw))) issues.push({ code: "plain_english_rewrite", before: raw, after: cleaned });
  if (TRUNCATED_ENDING.test(raw.trim())) issues.push({ code: "truncated_output", before: raw, after: cleaned });
  if (AI_CLICHES.some(([pattern]) => pattern.test(raw))) issues.push({ code: "ai_sounding_phrase", before: raw, after: cleaned });
  return issues;
}

export function readableProjectName(title: string, context?: Parameters<typeof cleanProjectTitle>[1]) {
  return cleanHeading(cleanProjectTitle(title, context).title, 64);
}

export function safePhrase(value: string | null | undefined, fallback: string) {
  const cleaned = cleanGeneratedCopy(String(value ?? ""));
  if (!cleaned || /^(idk|n\/a|none|null|undefined)$/i.test(cleaned)) return fallback;
  return cleaned;
}

export function lowerFirst(value: string) {
  const cleaned = safePhrase(value, "this problem");
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

export function sentence(value: string) {
  const cleaned = cleanGeneratedCopy(value);
  if (!cleaned) return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

export function articleFor(value: string) {
  const cleaned = cleanGeneratedCopy(value).trim();
  if (/^(AI|API|MVP|SEO|app|idea|offer|audience|education|automation)/i.test(cleaned)) return "an";
  return /^[aeiou]/i.test(cleaned) ? "an" : "a";
}

export function withArticle(value: string) {
  const cleaned = cleanGeneratedCopy(value);
  return `${articleFor(cleaned)} ${cleaned}`;
}

export function renderCopyTemplate(template: string, values: Record<string, string | number | null | undefined>) {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replace(new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g"), (match, offset: number) => {
      const fragment = cleanGeneratedCopy(String(value ?? ""));
      return shouldLowercaseTemplateFragment(output, offset) ? lowercaseFirstFragment(fragment) : fragment;
    });
  }
  return cleanGeneratedCopy(output);
}

function applyPlainEnglish(value: string) {
  let output = value;
  for (const [term, replacement] of Object.entries(PLAIN_ENGLISH_TERMS)) {
    output = output.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"), replacement);
  }
  return output;
}

function applyAiClicheCleanup(value: string) {
  return AI_CLICHES.reduce((output, [pattern, replacement]) => output.replace(pattern, replacement), value).replace(/\s+/g, " ").trim();
}

function fixArticles(value: string) {
  return value
    .replace(/\bA\s+(AI|API|MVP|SEO|education|automation|app)\b/g, "An $1")
    .replace(/\ba\s+(AI|API|MVP|SEO|education|automation|app)\b/g, "an $1")
    .replace(/\bAn\s+(user|tool|project|plan|workflow)\b/g, "A $1")
    .replace(/\ban\s+(user|tool|project|plan|workflow)\b/g, "a $1");
}

function dedupeAdjacentPhrases(value: string) {
  let output = value;
  for (let size = 4; size >= 1; size -= 1) {
    const words = output.split(" ");
    const next: string[] = [];
    for (let index = 0; index < words.length; index += 1) {
      const current = normalizeComparablePhrase(words.slice(index, index + size).join(" "));
      const following = normalizeComparablePhrase(words.slice(index + size, index + size * 2).join(" "));
      if (current && current === following) {
        next.push(...words.slice(index, index + size));
        index += size * 2 - 1;
      } else {
        next.push(words[index]);
      }
    }
    output = next.join(" ");
  }
  return output;
}

function normalizeAcronyms(value: string) {
  return value.replace(ACRONYM_PATTERN, (match) => {
    const lower = match.toLowerCase();
    if (lower === "ios") return "iOS";
    if (lower === "saas") return "SaaS";
    return lower.toUpperCase();
  });
}

function normalizeComparablePhrase(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

function shouldLowercaseTemplateFragment(template: string, offset: number) {
  const before = template.slice(0, offset).trimEnd();
  return before.length > 0 && !/[.!?:]\s*$/.test(before);
}

function lowercaseFirstFragment(value: string) {
  if (/^(AI|API|MVP|SEO|SaaS|iOS)\b/.test(value)) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function normalizeSentenceCapitalization(value: string, heading?: boolean) {
  if (!value) return value;
  if (heading) return value.charAt(0).toUpperCase() + value.slice(1);
  return value.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

function truncateCleanly(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength).trim();
  const sentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  const commaEnd = Math.max(clipped.lastIndexOf(","), clipped.lastIndexOf(";"), clipped.lastIndexOf(":"));
  const breakPoint = sentenceEnd >= Math.floor(maxLength * 0.45) ? sentenceEnd + 1 : commaEnd >= Math.floor(maxLength * 0.6) ? commaEnd : clipped.lastIndexOf(" ");
  const output = clipped.slice(0, breakPoint > 20 ? breakPoint : maxLength).replace(TRUNCATED_ENDING, "").replace(/[,;:.-]+$/g, "").trim();
  return output || clipped.replace(/[,;:.-]+$/g, "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
