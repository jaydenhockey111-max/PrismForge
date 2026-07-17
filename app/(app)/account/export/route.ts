import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const profile = await requireProfile();
  const admin = createAdminClient();
  const userId = profile.id;
  const [
    subscription,
    xp,
    xpEvents,
    opportunityProgress,
    rewards,
    badges,
    quests,
    notificationLogs,
    founderProjects,
    generationHistory,
    closureReflections,
    projectFocus,
    lifecycleEvents,
    founderTimeline,
    learningSnapshots,
    founderPatterns,
    founderPatternSources,
    founderPatternFeedback,
    guidancePreferences,
    intelligenceProfile,
    guidancePreferenceEvents,
  ] = await Promise.all([
    admin.from("subscriptions").select("status,current_period_end,cancel_at_period_end,created_at,updated_at").eq("user_id", userId).maybeSingle(),
    admin.from("user_xp").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("xp_events").select("action,xp_delta,project_id,progression_category,base_xp,verification_multiplier,awarded_xp,verification_level,source_type,source_id,reason,event_status,reverses_event_id,metadata,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    admin.from("user_opportunities").select("*").eq("user_id", userId).order("last_action_at", { ascending: false }).limit(1000),
    admin.from("user_rewards").select("reward_key,name,description,trigger,metadata,opened_at,expires_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    admin.from("user_badges").select("unlocked_at,metadata,badges(name,description,badge_key)").eq("user_id", userId).limit(1000),
    admin.from("user_daily_quests").select("quest_date,title,description,action_type,progress,target_count,completed_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    admin.from("notification_logs").select("opportunity_id,notification_type,sent_at").eq("user_id", userId).order("sent_at", { ascending: false }).limit(1000),
    (admin as any).from("opportunity_projects").select("id,title,business_type,target_customer,score,status,lifecycle_status,last_meaningful_activity_at,paused_at,resumed_at,completed_at,archived_at,abandoned_at,deleted_at,recovery_expires_at,report_json,created_at,updated_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    (admin as any).from("generation_history").select("id,input_json,output_json,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    admin.from("project_closure_reflections").select("project_id,outcome,what_was_learned,strongest_evidence,biggest_mistake,closure_reason,would_do_differently,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1000),
    admin.from("founder_project_focus").select("project_id,updated_at").eq("user_id",userId).maybeSingle(),
    admin.from("project_lifecycle_events").select("project_id,event_type,previous_status,next_status,reason,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(1000),
    admin.from("founder_timeline_events").select("project_id,event_type,category,headline,description,evidence_level,origin_system,request_id,metadata,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(5000),
    admin.from("founder_project_learning_snapshots").select("project_id,eligibility_status,eligibility_reason,project_type,lifecycle_outcome,stage_reached,hours_per_week,budget_band,risk_tolerance,technical_ability,validation_methods,evidence_types,meaningful_decision_count,experiment_count,customer_conversation_count,waitlist_signal_count,payment_intent_count,revenue_evidence_count,time_to_first_evidence_days,time_in_stages,blocker_categories,assumption_summary,decision_types,limitations,calculated_at").eq("user_id",userId).limit(5000),
    admin.from("founder_pattern_insights").select("id,insight_key,category,headline,explanation,evidence_tier,supporting_project_count,contradicting_project_count,limitations,dimensions,status,generated_at,data_through").eq("user_id",userId).order("generated_at",{ascending:false}).limit(5000),
    admin.from("founder_pattern_insight_sources").select("insight_id,project_id,source_role,source_kind,source_id,created_at").eq("user_id",userId).limit(10000),
    admin.from("founder_pattern_feedback").select("insight_id,feedback_type,reason,excluded_project_id,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(5000),
    admin.from("founder_guidance_preferences").select("guidance_mode,explanation_depth,quest_intensity,historical_personalization_enabled,show_historical_reminders,show_personalization_reasons,preference_version,created_at,updated_at").eq("user_id",userId).maybeSingle(),
    admin.from("founder_intelligence_profiles").select("profile_version,status,profile_json,learning_version,generated_at,data_through,created_at,updated_at").eq("user_id",userId).maybeSingle(),
    admin.from("founder_guidance_preference_events").select("event_type,request_id,previous_preferences,next_preferences,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(1000),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    profile: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      age: profile.age,
      state: profile.state,
      income_range: profile.income_range,
      student_status: profile.student_status,
      occupation: profile.occupation,
      interests: profile.interests,
      goals: profile.goals,
      resume_link: profile.resume_link,
      education_level: profile.education_level,
      plan: profile.plan,
      alerts_enabled: profile.alerts_enabled,
      onboarding_completed: profile.onboarding_completed,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    },
    subscription: subscription.data,
    xp: xp.data,
    xp_events: xpEvents.data ?? [],
    opportunity_progress: opportunityProgress.data ?? [],
    rewards: rewards.data ?? [],
    badges: badges.data ?? [],
    daily_quests: quests.data ?? [],
    notification_logs: notificationLogs.data ?? [],
    founder_projects: founderProjects.data ?? [],
    generation_history: generationHistory.data ?? [],
    project_closure_reflections: closureReflections.data ?? [],
    current_project_focus: projectFocus.data,
    project_lifecycle_events: lifecycleEvents.data ?? [],
    founder_timeline: founderTimeline.data ?? [],
    founder_learning_snapshots: learningSnapshots.data ?? [],
    founder_patterns: founderPatterns.data ?? [],
    founder_pattern_sources: founderPatternSources.data ?? [],
    founder_pattern_feedback: founderPatternFeedback.data ?? [],
    founder_guidance_preferences: guidancePreferences.data,
    founder_intelligence_profile: intelligenceProfile.data,
    founder_guidance_preference_events: guidancePreferenceEvents.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="prismforge-data-${userId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
