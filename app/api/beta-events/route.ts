import { NextResponse } from "next/server";
import type { BetaEventName } from "@/lib/analytics/betaEvents";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

const allowedClientEvents = new Set<BetaEventName>([
  "project_creation_submit_clicked",
  "project_creation_client_started",
  "project_creation_request_sent",
  "project_creation_validation_failed",
  "project_creation_client_timeout",
  "duplicate_submission_blocked",
  "field_suggestion_viewed",
  "field_suggestion_clicked",
  "guided_idea_mode_opened",
  "form_completed",
  "form_abandoned",
  "value_summary_copied",
  "outreach_copy_copied",
  "next_best_action_selected",
  "validation_path_selected",
  "ai_employee_opened",
  "ai_employee_started",
  "ai_employee_completed",
  "ai_employee_failed",
  "ai_employee_retry_clicked",
  "ai_employee_cache_hit",
  "project_title_rename_started",
  "quest_viewed",
  "quest_started",
  "quest_completed",
  "quest_completion_verified",
  "quest_completed_manually",
  "quest_skipped",
  "quest_replaced",
  "quest_replacement_reason_submitted",
  "quest_progress_updated",
  "quest_next_best_action_linked",
  "duplicate_quest_completion_prevented",
  "project_filter_applied",
  "project_sort_changed",
  "project_search_used",
  "project_switcher_opened",
  "project_switcher_project_selected",
  "core_loop_assumption_viewed",
  "core_loop_next_action_started",
  "core_loop_support_opened",
  "core_loop_evidence_started",
  "core_loop_feedback_prompt_viewed",
  "core_loop_feedback_submitted",
  "core_loop_error_viewed",
  "payment_signal_recorded",
  "case_study_permission_recorded",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { eventName?: string; metadata?: Record<string, Json | undefined> };
    if (!body.eventName || !allowedClientEvents.has(body.eventName as BetaEventName)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const projectId = typeof body.metadata?.project_id === "string" ? body.metadata.project_id : null;
    if (projectId) {
      const { data: project } = await supabase.from("opportunity_projects").select("id").eq("id", projectId).eq("user_id", user.id).maybeSingle();
      if (!project) return NextResponse.json({ ok: false }, { status: 403 });
    }

    if (body.eventName === "core_loop_feedback_submitted" && projectId) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase.from("app_events").select("id,metadata").eq("user_id", user.id).eq("event_name", body.eventName).gte("created_at", since).limit(20);
      const alreadySubmitted = (recent ?? []).some((event) => (event.metadata as Record<string, Json> | null)?.project_id === projectId);
      if (alreadySubmitted) return NextResponse.json({ ok: true, cached: true });
    }

    await supabase.from("app_events").insert({
      user_id: user.id,
      event_name: body.eventName,
      metadata: sanitizeMetadata(body.metadata ?? {}),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

function sanitizeMetadata(metadata: Record<string, Json | undefined>) {
  const safe: Record<string, Json> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 120);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) safe[key] = value;
  }
  return safe;
}
