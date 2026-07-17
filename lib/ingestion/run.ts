import type { Json } from "@/lib/database.types";
import type { IngestionResult } from "@/lib/ingestion/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function runGrantsGovIngestion(): Promise<IngestionResult> {
  const admin = createAdminClient();
  const sourceName = "grants-gov-disabled";
  const { data: run, error } = await admin.from("ingestion_runs").insert({ source_name: sourceName }).select("id").single();
  if (error || !run) throw new Error(error?.message ?? "Could not create disabled ingestion run");

  const result: IngestionResult = {
    runId: run.id,
    sourceName,
    discovered: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    archived: 0,
    errors: [],
  };

  await admin.from("ingestion_runs").update({
    status: "succeeded",
    completed_at: new Date().toISOString(),
    discovered_count: 0,
    inserted_count: 0,
    updated_count: 0,
    unchanged_count: 0,
    archived_count: 0,
    error_count: 0,
    metadata: {
    skipped: "Legacy ingestion is disabled. PrismForge now uses project-scoped Market Pulse / Live Intelligence.",
    } as Json,
  }).eq("id", run.id);

  return result;
}
