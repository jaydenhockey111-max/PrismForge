import type { EligibilityRules, Json, OpportunityCategory } from "@/lib/database.types";

export type NormalizedOpportunity = {
  sourceName: string;
  sourceId: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  title: string;
  description: string;
  deadline: string | null;
  category: OpportunityCategory;
  eligibilityRules: EligibilityRules;
  eligibilitySummary: string | null;
  status: "published" | "draft" | "archived";
  reviewStatus: "approved" | "pending" | "rejected";
  rawData: Json;
};

export type IngestionResult = {
  runId: string;
  sourceName: string;
  discovered: number;
  inserted: number;
  updated: number;
  unchanged: number;
  archived: number;
  errors: string[];
};
