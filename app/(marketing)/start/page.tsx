import { redirect } from "next/navigation";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { ensureUserProfile, getCurrentProfile, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const user = await getCurrentUser();

  if (!user) {
    await logBetaEvent({
      eventName: "start_creating_route_selected",
      source: "start_route",
      metadata: { authenticated: false, profile_exists: false, target_route: "/sign-up?next=/generate" },
    });
    await logBetaEvent({
      eventName: "auth_redirect_triggered",
      source: "start_route",
      metadata: { authenticated: false, target_route: "/sign-up?next=/generate", reason: "signed_out" },
    });
    redirect("/sign-up?next=/generate");
  }

  let profile = await getCurrentProfile();
  if (!profile) {
    await logBetaEvent({
      userId: user.id,
      eventName: "profile_repair_attempted",
      source: "start_route",
      metadata: { authenticated: true, profile_exists: false },
    });
    profile = await ensureUserProfile(user);
  }

  if (!profile) {
    await logBetaEvent({
      userId: user.id,
      eventName: "auth_state_mismatch_detected",
      source: "start_route",
      metadata: { authenticated: true, profile_exists: false, target_route: "/sign-in?next=/generate", error_category: "profile_missing" },
    });
    redirect("/sign-in?next=/generate");
  }

  await logBetaEvent({
    userId: profile.id,
    eventName: "start_creating_route_selected",
    source: "start_route",
    metadata: { authenticated: true, profile_exists: true, target_route: "/generate" },
  });
  redirect("/generate");
}
