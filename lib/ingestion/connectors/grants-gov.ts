import type { EligibilityRules, Json } from "@/lib/database.types";
import type { NormalizedOpportunity } from "@/lib/ingestion/types";

const API_BASE = "https://api.grants.gov/v1/api";
const DETAIL_BASE = "https://www.grants.gov/search-results-detail";
export const GRANTS_GOV_SOURCE = "grants.gov";

type GrantsSearchHit = {
  id: string | number;
  number: string;
  title: string;
  agency: string;
  agencyCode: string;
  openDate: string;
  closeDate: string;
  oppStatus: string;
};

type GrantsSearchResponse = {
  errorcode: number;
  msg: string;
  data?: { hitCount: number; oppHits: GrantsSearchHit[] };
};

type GrantsSynopsis = {
  synopsisDesc?: string;
  responseDate?: string;
  responseDateStr?: string;
  postingDate?: string;
  lastUpdatedDate?: string;
  applicantEligibilityDesc?: string;
  applicantTypes?: unknown[];
  fundingActivityCategories?: unknown[];
  fundingInstruments?: unknown[];
  agencyName?: string;
};

export type GrantsDetail = {
  id: string | number;
  opportunityNumber?: string;
  opportunityTitle?: string;
  owningAgencyCode?: string;
  synopsis?: GrantsSynopsis;
  opportunityCategory?: { category?: string; description?: string };
  [key: string]: unknown;
};

type GrantsDetailResponse = { errorcode: number; msg: string; data?: GrantsDetail };

export async function searchIndividualGrants(limit = 20): Promise<{ total: number; hits: GrantsSearchHit[] }> {
  const rows = Math.min(Math.max(limit, 1), 100);
  const response = await postJson<GrantsSearchResponse>("search2", {
    rows,
    startRecordNum: 0,
    eligibilities: "21",
    oppStatuses: "posted",
    sortBy: "openDate|desc",
  });
  if (response.errorcode !== 0 || !response.data) throw new Error(response.msg || "Grants.gov search failed");
  return { total: response.data.hitCount, hits: response.data.oppHits ?? [] };
}

export async function fetchGrantDetail(id: string | number) {
  const response = await postJson<GrantsDetailResponse>("fetchOpportunity", { opportunityId: Number(id) });
  if (response.errorcode !== 0 || !response.data) throw new Error(response.msg || `Grants.gov detail ${id} failed`);
  return response.data;
}

async function postJson<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "PrismForge/1.0" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Grants.gov ${endpoint} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export function normalizeGrant(detail: GrantsDetail): NormalizedOpportunity {
  const synopsis = detail.synopsis ?? {};
  const id = String(detail.id);
  const title = cleanText(detail.opportunityTitle ?? "Federal grant opportunity").slice(0, 160);
  const agency = cleanText(synopsis.agencyName ?? detail.owningAgencyCode ?? "a U.S. government agency");
  const description = ensureDescription(cleanText(synopsis.synopsisDesc ?? ""), title, agency).slice(0, 5000);
  const eligibilitySummary = nullableText(synopsis.applicantEligibilityDesc);
  const deadline = parseSourceDate(synopsis.responseDateStr ?? synopsis.responseDate);
  const sourceUpdatedAt = parseTimestamp(synopsis.lastUpdatedDate ?? synopsis.postingDate);
  const interestText = [title, description, JSON.stringify(synopsis.fundingActivityCategories ?? [])].join(" ");
  const interests = inferInterests(interestText);
  const eligibilityRules: EligibilityRules = interests.length ? { interests } : {};

  return {
    sourceName: GRANTS_GOV_SOURCE,
    sourceId: id,
    sourceUrl: `${DETAIL_BASE}/${encodeURIComponent(id)}`,
    sourceUpdatedAt,
    title,
    description,
    deadline,
    category: "startup_grant",
    eligibilityRules,
    eligibilitySummary,
    status: deadline && deadline < today() ? "archived" : "published",
    reviewStatus: "approved",
    rawData: detail as unknown as Json,
  };
}

function ensureDescription(description: string, title: string, agency: string) {
  if (description.length >= 20) return description;
  return `${title} is a federal funding opportunity published by ${agency}. Review the official Grants.gov notice for complete program and application details.`;
}

export function cleanText(value: string) {
  return decodeEntities(value)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function nullableText(value?: string) {
  if (!value) return null;
  const text = cleanText(value);
  return text ? text.slice(0, 5000) : null;
}

export function parseSourceDate(value?: string): string | null {
  if (!value) return null;
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString().slice(0, 10);
}

function parseTimestamp(value?: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function inferInterests(value: string) {
  const text = value.toLowerCase();
  const map: [string, string[]][] = [
    ["Arts", [" art", "humanities", "museum", "culture"]],
    ["Business", ["business", "commerce", "entrepreneur", "small business"]],
    ["Community Service", ["community", "public service", "social service"]],
    ["Education", ["education", "student", "school", "teacher", "learning"]],
    ["Engineering", ["engineering", "infrastructure", "manufacturing"]],
    ["Environment", ["environment", "climate", "conservation", "natural resource"]],
    ["Finance", ["financial", "economic", "income"]],
    ["Health", ["health", "medical", "disease", "clinical", "nutrition"]],
    ["Research", ["research", "study", "scientific"]],
    ["Science", ["science", "scientific", "biology", "chemistry", "physics", "stem"]],
    ["Technology", ["technology", "digital", "cyber", "computing", "software"]],
  ];
  return map.filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword))).map(([interest]) => interest);
}
