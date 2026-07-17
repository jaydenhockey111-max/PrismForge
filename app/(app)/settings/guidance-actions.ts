"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { createClient } from "@/lib/supabase/server";

const preferencesSchema = z.object({
  guidanceMode: z.enum(["guided", "balanced", "autonomous"]),
  explanationDepth: z.enum(["brief", "standard", "detailed"]),
  questIntensity: z.enum(["light", "standard", "ambitious"]),
});

export async function updateGuidancePreferences(formData: FormData) {
  const profile = await requireProfile();
  const requestId = crypto.randomUUID();
  const parsed = preferencesSchema.safeParse({
    guidanceMode: formData.get("guidance_mode"),
    explanationDepth: formData.get("explanation_depth"),
    questIntensity: formData.get("quest_intensity"),
  });
  if (!parsed.success) redirect("/settings?error=Choose valid guidance settings.");
  const historical = formData.get("historical_personalization_enabled") === "on";
  const reminders = historical && formData.get("show_historical_reminders") === "on";
  const reasons = formData.get("show_personalization_reasons") === "on";
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_founder_guidance_preferences", {
    p_guidance_mode: parsed.data.guidanceMode,
    p_explanation_depth: parsed.data.explanationDepth,
    p_quest_intensity: parsed.data.questIntensity,
    p_historical_personalization_enabled: historical,
    p_show_historical_reminders: reminders,
    p_show_personalization_reasons: reasons,
    p_request_id: requestId,
  } as never);
  if (error) redirect(`/settings?error=${encodeURIComponent("Guidance settings could not be saved.")}`);
  await Promise.all([
    logBetaEvent({ userId: profile.id, eventName: "founder_guidance_mode_changed", source: "settings", metadata: { request_id: requestId, guidance_mode: parsed.data.guidanceMode, ai_used: false } }),
    logBetaEvent({ userId: profile.id, eventName: "explanation_depth_changed", source: "settings", metadata: { request_id: requestId, explanation_depth: parsed.data.explanationDepth, ai_used: false } }),
    logBetaEvent({ userId: profile.id, eventName: "quest_intensity_changed", source: "settings", metadata: { request_id: requestId, quest_intensity: parsed.data.questIntensity, ai_used: false } }),
    logBetaEvent({ userId: profile.id, eventName: historical ? "historical_personalization_enabled" : "historical_personalization_disabled", source: "settings", metadata: { request_id: requestId, ai_used: false } }),
  ]);
  revalidateGuidanceSurfaces();
  redirect("/settings?message=Guidance settings saved.");
}

export async function resetFounderPersonalization() {
  const profile = await requireProfile();
  const requestId = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_founder_personalization", { p_request_id: requestId } as never);
  if (error) redirect(`/settings?error=${encodeURIComponent("Personalization could not be reset.")}`);
  await logBetaEvent({ userId: profile.id, eventName: "personalization_reset", source: "settings", metadata: { request_id: requestId, ai_used: false } });
  revalidateGuidanceSurfaces();
  redirect("/settings?message=Inferred guidance was reset. Your chosen settings were kept.");
}

function revalidateGuidanceSurfaces() {
  revalidatePath("/settings");
  revalidatePath("/progress");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

