import type { BusinessType, FounderGoal, ProjectStatus, UserOpportunityInput } from "@/lib/founder-os/types";
import { projectTitleFromInput } from "./titleQuality";

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  saas: "SaaS",
  ai_tool: "AI tool",
  digital_product: "Digital product",
  local_service: "Local service",
  content_business: "Content business",
  e_commerce: "E-commerce",
};

export const GOAL_LABELS: Record<FounderGoal, string> = {
  learn: "Learn entrepreneurship",
  side_income: "Side income",
  full_time_business: "Full-time business",
  viral_app: "Viral app",
  subscription_saas: "Subscription SaaS",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: "Idea",
  validating: "Validating",
  building: "Building",
  launched: "Launched",
};

export const BUSINESS_TYPES = ["saas", "ai_tool", "digital_product", "local_service", "content_business", "e_commerce"] as const satisfies readonly BusinessType[];
export const FOUNDER_GOALS = ["learn", "side_income", "full_time_business", "viral_app", "subscription_saas"] as const satisfies readonly FounderGoal[];
export const PROJECT_STATUSES = ["idea", "validating", "building", "launched"] as const satisfies readonly ProjectStatus[];

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function compactList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function firstInterest(input: UserOpportunityInput) {
  return compactList(input.interests)[0] ?? "a niche they care about";
}

export function firstSkill(input: UserOpportunityInput) {
  return compactList(input.skills)[0] ?? "fast execution";
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function productNoun(input: UserOpportunityInput) {
  if (input.businessType === "saas") return "workspace";
  if (input.businessType === "ai_tool") return "AI assistant";
  if (input.businessType === "digital_product") return "playbook";
  if (input.businessType === "local_service") return "done-for-you service";
  if (input.businessType === "content_business") return "media engine";
  return "curated storefront";
}

export function projectTitle(input: UserOpportunityInput) {
  if (input.existingIdea?.trim()) return projectTitleFromInput(input).slice(0, 90);
  const audience = input.targetAudience.trim() || "busy builders";
  const interest = firstInterest(input);
  return projectTitleFromInput({ ...input, existingIdea: `${interest} ${productNoun(input)} for ${audience}` }).slice(0, 90);
}

export function cleanSentence(value: string) {
  return value
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\u00e2\u20ac["\u201d\u201c]/g, "-")
    .replace(/\u00e2\u20ac[\u0153\ufffd]/g, "\"")
    .replace(/\u00e2\u20ac[\u02dc\u2122]/g, "'")
    .replace(/\u00e2\u2020\u2019/g, "->")
    .replace(/\s+/g, " ")
    .trim();
}

export function shortProjectName(value: string) {
  const cleaned = cleanSentence(value)
    .replace(/^(an?|the)\s+/i, "")
    .replace(/\s+(that|which)\s+(helps?|turns?|lets?|allows?|gives?)\b[\s\S]*$/i, "")
    .replace(/\s+for\s+(high school students|students|founders|creators|beginners|teams|parents|teachers|freelancers|small businesses)\b[\s\S]*$/i, "")
    .replace(/[,:;–—-]\s*.+$/, "")
    .trim();
  if (cleaned.length <= 48) return cleaned || cleanSentence(value).slice(0, 48);
  const words = cleaned.split(" ");
  const compact = words.slice(0, 5).join(" ");
  return compact.length >= 12 ? compact : cleaned.slice(0, 48).trim();
}

export function projectSeed(input: UserOpportunityInput) {
  return [
    input.existingIdea,
    input.businessType,
    input.targetAudience,
    input.interests,
    input.skills,
    input.goal,
    input.timePerWeek,
    input.budget,
  ].join("|").toLowerCase();
}

export function audienceLabel(input: UserOpportunityInput) {
  return cleanSentence(input.targetAudience || "your target customer").toLowerCase();
}

export function ideaLabel(input: UserOpportunityInput) {
  return shortProjectName(projectTitle(input));
}

export function hash(input: string) {
  let result = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    result ^= input.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function seededNumber(seed: string, min: number, max: number) {
  const spread = max - min;
  return min + (hash(seed) % (spread + 1));
}

export function seededPick<T>(items: readonly T[], seed: string) {
  return items[hash(seed) % items.length];
}

export function currencyBudget(input: UserOpportunityInput) {
  if (input.budget <= 0) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(input.budget);
}

export function safeDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}
