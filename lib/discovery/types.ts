import type { EligibilityRules, Json, OpportunityCategory } from "@/lib/database.types";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  rawContent: string;
  score: number;
  query: string;
};

export type ExtractedWebOpportunity = {
  title: string;
  description: string;
  category: OpportunityCategory | null;
  deadline: string | null;
  eligibilityRules: EligibilityRules;
  eligibilitySummary: string | null;
  confidence: number;
  trustLevel: "official" | "trusted" | "unverified" | "blocked";
  autoPublish: boolean;
  statusReason: string;
  extraction: Json;
};
