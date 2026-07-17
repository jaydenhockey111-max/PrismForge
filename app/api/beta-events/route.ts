import { NextResponse } from "next/server";
import type { BetaEventName } from "@/lib/analytics/betaEvents";
import { clientRequestId, sanitizeClientEventMetadata } from "@/lib/analytics/clientEventPolicy";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
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
  "core_loop_feedback_dismissed",
  "core_loop_error_viewed",
  "payment_signal_recorded",
  "case_study_permission_recorded",
]);

export async function POST(request: Request) {
  let requestId = crypto.randomUUID();
  let caseStudyEligible = false;
  try {
    const body = await request.json() as { eventName?: string; metadata?: Record<string, Json | undefined> };
    requestId = clientRequestId(body.metadata?.request_id);
    if (!body.eventName || !allowedClientEvents.has(body.eventName as BetaEventName)) {
      return NextResponse.json({ ok: false, requestId }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, requestId }, { status: 401 });

    const projectId = typeof body.metadata?.project_id === "string" ? body.metadata.project_id : null;
    if (projectId) {
      const { data: project } = await supabase.from("opportunity_projects").select("id").eq("id", projectId).eq("user_id", user.id).maybeSingle();
      if (!project) return NextResponse.json({ ok: false, requestId }, { status: 403 });
    }

    if (body.eventName === "core_loop_feedback_dismissed") {
      if (!projectId) return NextResponse.json({ ok: false, requestId }, { status: 400 });
      const { data: existing, error: existingError } = await supabase
        .from("core_value_feedback")
        .select("id,rating")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .maybeSingle();
      if (existingError) return NextResponse.json({ ok: false, requestId }, { status: 500 });
      if (existing?.rating) return NextResponse.json({ ok: true, cached: true, requestId });

      const promptDismissedAt = new Date();
      const promptEligibleAfter = new Date(promptDismissedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const mutation = existing
        ? supabase.from("core_value_feedback").update({
            prompt_dismissed_at: promptDismissedAt.toISOString(),
            prompt_eligible_after: promptEligibleAfter.toISOString(),
            request_id: requestId,
          }).eq("id", existing.id)
        : supabase.from("core_value_feedback").insert({
            user_id: user.id,
            project_id: projectId,
            rating: null,
            request_id: requestId,
            prompt_dismissed_at: promptDismissedAt.toISOString(),
            prompt_eligible_after: promptEligibleAfter.toISOString(),
          });
      const { error: dismissError } = await mutation;
      if (dismissError) return NextResponse.json({ ok: false, requestId }, { status: 500 });
    }

    if (body.eventName === "core_loop_feedback_submitted") {
      if (!projectId) return NextResponse.json({ ok: false, requestId }, { status: 400 });
      const rating = body.metadata?.rating;
      if (rating !== "yes" && rating !== "somewhat" && rating !== "no") {
        return NextResponse.json({ ok: false, requestId }, { status: 400 });
      }

      const { data: existing, error: existingError } = await supabase
        .from("core_value_feedback")
        .select("id,rating")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .maybeSingle();
      if (existingError) return NextResponse.json({ ok: false, requestId }, { status: 500 });
      if (existing?.rating) return NextResponse.json({ ok: true, cached: true, requestId });

      const decisionSummary = typeof body.metadata?.follow_up === "string"
        ? body.metadata.follow_up.trim().slice(0, 500) || null
        : null;
      const recommendationMoreUseful = typeof body.metadata?.recommendation_more_useful === "boolean"
        ? body.metadata.recommendation_more_useful
        : null;
      const feedbackMutation = existing
        ? supabase.from("core_value_feedback").update({
            rating,
            decision_summary: decisionSummary,
            recommendation_more_useful: recommendationMoreUseful,
            request_id: requestId,
            prompt_eligible_after: null,
          }).eq("id", existing.id)
        : supabase.from("core_value_feedback").insert({
            user_id: user.id,
            project_id: projectId,
            rating,
            decision_summary: decisionSummary,
            recommendation_more_useful: recommendationMoreUseful,
            request_id: requestId,
          });
      const { error: feedbackError } = await feedbackMutation;
      if (feedbackError) {
        if (feedbackError.code === "23505") return NextResponse.json({ ok: true, cached: true, requestId });
        return NextResponse.json({ ok: false, requestId }, { status: 500 });
      }
      if (rating === "yes") {
        const { data: decision } = await supabase
          .from("project_decisions")
          .select("id")
          .eq("user_id", user.id)
          .eq("project_id", projectId)
          .limit(1)
          .maybeSingle();
        caseStudyEligible = Boolean(decision);
      }
    }

    if (body.eventName === "case_study_permission_recorded") {
      if (!projectId || body.metadata?.permission !== true) {
        return NextResponse.json({ ok: false, requestId }, { status: 400 });
      }
      const { data: decision } = await supabase
        .from("project_decisions")
        .select("id")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .limit(1)
        .maybeSingle();
      if (!decision) return NextResponse.json({ ok: false, requestId }, { status: 409 });
      const { data: updated, error: permissionError } = await supabase
        .from("core_value_feedback")
        .update({
          contact_permission: true,
          contact_preference: "account_email",
          milestone_category: "core_loop_helpful",
          permission_updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .eq("rating", "yes")
        .select("id")
        .maybeSingle();
      if (permissionError || !updated) return NextResponse.json({ ok: false, requestId }, { status: 409 });
    }

    const admin = createAdminClient();
    const { error: analyticsError } = await admin.from("app_events").insert({
      user_id: user.id,
      event_name: body.eventName,
      metadata: sanitizeClientEventMetadata(body.metadata ?? {}, requestId),
    });
    if (analyticsError) {
      console.error("Client beta event persistence failed", {
        eventName: body.eventName,
        requestId,
        code: analyticsError.code,
      });
      if (body.eventName === "core_loop_feedback_submitted" || body.eventName === "core_loop_feedback_dismissed" || body.eventName === "case_study_permission_recorded") {
        return NextResponse.json({ ok: true, saved: true, analyticsSaved: false, requestId, caseStudyEligible });
      }
      return NextResponse.json({ ok: false, requestId }, { status: 500 });
    }

    return NextResponse.json({ ok: true, requestId, caseStudyEligible });
  } catch {
    return NextResponse.json({ ok: false, requestId }, { status: 500 });
  }
}
