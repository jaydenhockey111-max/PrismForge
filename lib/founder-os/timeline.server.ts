import "server-only";
import type { FounderTimelineResult } from "@/lib/database.types";
import { cleanTimelineQuery, parseTimelineCategory, parseTimelineCursor } from "@/lib/founder-os/timeline";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export async function loadFounderTimeline(input: { projectId?: string | null; category?: string; query?: string; before?: string }) {
  const supabase = await createClient();
  const category = parseTimelineCategory(input.category);
  const query = cleanTimelineQuery(input.query);
  const cursor = parseTimelineCursor(input.before);
  const { data, error } = await supabase.rpc("search_founder_timeline", {
    p_project_id: input.projectId ?? null,
    p_category: category,
    p_query: query || null,
    p_before_created_at: cursor.createdAt,
    p_before_id: cursor.id,
    p_limit: PAGE_SIZE + 1,
  });
  if (error) return { events: [] as FounderTimelineResult[], category, query, nextPage: false, error: timelineError(error.message) };
  const rows = (data ?? []) as FounderTimelineResult[];
  return { events: rows.slice(0, PAGE_SIZE), category, query, nextPage: rows.length > PAGE_SIZE, error: null };
}

function timelineError(message: string) {
  return /search_founder_timeline|founder_timeline_events|schema cache|does not exist/i.test(message)
    ? "Founder Timeline is awaiting the Tier 3A Supabase migration."
    : "Timeline history could not be loaded. Please refresh and try again.";
}

