import { createHash } from "node:crypto";
import type { SearchResult } from "@/lib/discovery/types";
import type { EligibilityRules, Json, Opportunity } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { ESTIMATED_VALUE_BY_CATEGORY } from "@/lib/gamification/config";

export type WebDiscoveryResult = {
  runId: string;
  discovered: number;
  inserted: number;
  updated: number;
  unchanged: number;
  published: number;
  quarantined: number;
  errors: string[];
  skipped?: string;
};

export async function runWebDiscovery(): Promise<WebDiscoveryResult> {
  const admin = createAdminClient();
  const { data: run, error: runError } = await admin.from("ingestion_runs").insert({ source_name: "market-pulse-local" }).select("id").single();
  if (runError || !run) throw new Error(runError?.message ?? "Could not create discovery run");
  const result: WebDiscoveryResult = { runId: run.id, discovered: 0, inserted: 0, updated: 0, unchanged: 0, published: 0, quarantined: 0, errors: [] };

  try {
    result.skipped = "Broad opportunity discovery is disabled. Use project-scoped Market Pulse manual refresh for Live Intelligence.";
    await finishRun(run.id, result, "succeeded");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market Pulse bookkeeping failed";
    await admin.from("ingestion_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_count: result.errors.length + 1, error_message: message, metadata: { errors: result.errors.slice(0, 10) } as Json }).eq("id", run.id);
    throw error;
  }
}

type PublishableDiscovery = {
  title: string;
  description: string;
  category: Opportunity["category"];
  deadline: string | null;
  eligibilityRules: EligibilityRules;
  eligibilitySummary?: string | null;
  extraction?: Json;
};

export async function publishOpportunity(candidateId: string, searchResult: SearchResult, extracted: PublishableDiscovery) {
  const admin = createAdminClient();
  const domain = new URL(searchResult.url).hostname.toLowerCase();
  const sourceId = sha256(searchResult.url);
  const checksum = sha256(JSON.stringify({ title: extracted.title, description: extracted.description, deadline: extracted.deadline, rules: extracted.eligibilityRules }));
  const payload: Partial<Opportunity> & Pick<Opportunity, "title" | "description" | "category" | "url" | "status" | "eligibility_rules"> = {
    title: extracted.title, description: extracted.description, category: extracted.category,
    deadline: extracted.deadline, eligibility_rules: extracted.eligibilityRules,
    url: searchResult.url, status: "published", created_by: null,
    source_name: `web:${domain}`, source_id: sourceId, source_url: searchResult.url,
    source_updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
    eligibility_summary: extracted.eligibilitySummary, review_status: "approved",
    estimated_value: ESTIMATED_VALUE_BY_CATEGORY[extracted.category],
    checksum, raw_data: { candidate_id: candidateId, search_query: searchResult.query, extraction: extracted.extraction } as Json,
  };
  const { data, error } = await admin.from("opportunities").upsert(payload, { onConflict: "source_name,source_id" }).select("id").single();
  if (error || !data) throw error ?? new Error("Opportunity publication failed");
  return data.id;
}

async function finishRun(runId: string, result: WebDiscoveryResult, status: "succeeded" | "failed") {
  const admin = createAdminClient();
  const { error } = await admin.from("ingestion_runs").update({
    status, completed_at: new Date().toISOString(), discovered_count: result.discovered,
    inserted_count: result.inserted, updated_count: result.updated, unchanged_count: result.unchanged,
    error_count: result.errors.length,
    metadata: {
      published: result.published,
      quarantined: result.quarantined,
      skipped: result.skipped,
      mode: "project_scoped_live_intelligence",
      query_pack_count: 0,
      query_categories: [],
      query_sources: [],
      errors: result.errors.slice(0, 10),
    } as Json,
  }).eq("id", runId);
  if (error) throw error;
}

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
