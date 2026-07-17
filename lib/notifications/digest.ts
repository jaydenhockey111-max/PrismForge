import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Opportunity, Profile, UserXp } from "@/lib/database.types";
import { getEntitlements } from "@/lib/billing/entitlements";
import { rankOpportunities, type MatchResult } from "@/lib/matching";

export type DigestItem = {
  match: MatchResult;
  types: Array<"new_match" | "deadline_reminder">;
};

export type NotificationDigest = {
  user: Profile;
  items: DigestItem[];
};

type AdminClient = SupabaseClient<Database>;

const DAY_MS = 86_400_000;

export const NOTIFICATION_LIMITS = {
  profileBatchSize: numberFromEnv("NOTIFICATION_PROFILE_BATCH_SIZE", 500, 25, 2_000),
  opportunityBatchSize: numberFromEnv("NOTIFICATION_OPPORTUNITY_BATCH_SIZE", 750, 25, 5_000),
  minScore: numberFromEnv("NOTIFICATION_MIN_SCORE", 75, 1, 100),
  maxItemsPerDigest: numberFromEnv("NOTIFICATION_MAX_ITEMS_PER_DIGEST", 8, 1, 20),
  recentHours: numberFromEnv("NOTIFICATION_RECENT_HOURS", 25, 1, 168),
  deadlineDays: numberFromEnv("NOTIFICATION_DEADLINE_DAYS", 7, 1, 30),
};

function numberFromEnv(key: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[key]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

export async function getNotificationCandidates(admin: AdminClient, now = new Date()) {
  const cutoff = new Date(now.getTime() - NOTIFICATION_LIMITS.recentHours * 60 * 60 * 1000).toISOString();
  const today = now.toISOString().slice(0, 10);
  const deadlineEnd = new Date(now.getTime() + NOTIFICATION_LIMITS.deadlineDays * DAY_MS).toISOString().slice(0, 10);

  const [recent, deadlines] = await Promise.all([
    admin
      .from("opportunities")
      .select("*")
      .eq("status", "published")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(NOTIFICATION_LIMITS.opportunityBatchSize),
    admin
      .from("opportunities")
      .select("*")
      .eq("status", "published")
      .gte("deadline", today)
      .lte("deadline", deadlineEnd)
      .order("deadline", { ascending: true })
      .limit(NOTIFICATION_LIMITS.opportunityBatchSize),
  ]);

  if (recent.error) throw recent.error;
  if (deadlines.error) throw deadlines.error;

  const byId = new Map<string, Opportunity>();
  for (const opportunity of [...(recent.data ?? []), ...(deadlines.data ?? [])]) byId.set(opportunity.id, opportunity);
  return [...byId.values()];
}

export async function getAlertProfiles(admin: AdminClient) {
  const { data: paidProfiles, error: paidError } = await admin
    .from("profiles")
    .select("*")
    .eq("plan", "premium")
    .eq("alerts_enabled", true)
    .order("created_at", { ascending: true })
    .limit(NOTIFICATION_LIMITS.profileBatchSize);
  if (paidError) throw paidError;

  const { data: trialRows, error: trialError } = await admin
    .from("user_xp")
    .select("user_id,premium_trial_until")
    .gt("premium_trial_until", new Date().toISOString())
    .limit(NOTIFICATION_LIMITS.profileBatchSize);
  if (trialError) throw trialError;

  const trialIds = [...new Set((trialRows ?? []).map((row) => row.user_id))];
  const { data: trialProfiles, error: trialProfileError } = trialIds.length
    ? await admin.from("profiles").select("*").in("id", trialIds).eq("alerts_enabled", true)
    : { data: [] as Profile[], error: null };
  if (trialProfileError) throw trialProfileError;

  const xpByUser = new Map((trialRows ?? []).map((row) => [row.user_id, row as Pick<UserXp, "premium_trial_until">]));
  const byId = new Map<string, Profile>();
  for (const profile of [...(paidProfiles ?? []), ...(trialProfiles ?? [])]) {
    if (getEntitlements(profile, xpByUser.get(profile.id)).hasPremiumAccess) byId.set(profile.id, profile);
  }
  return [...byId.values()].slice(0, NOTIFICATION_LIMITS.profileBatchSize);
}

export async function buildDigestForProfile(admin: AdminClient, profile: Profile, candidates: Opportunity[], now = new Date()): Promise<NotificationDigest | null> {
  if (!candidates.length) return null;
  const candidateIds = candidates.map((opportunity) => opportunity.id);
  const { data: logs, error } = await admin
    .from("notification_logs")
    .select("opportunity_id,notification_type")
    .eq("user_id", profile.id)
    .in("opportunity_id", candidateIds);
  if (error) throw error;

  const logged = new Set((logs ?? []).map((log) => `${log.opportunity_id}:${log.notification_type}`));
  const cutoff = now.getTime() - NOTIFICATION_LIMITS.recentHours * 60 * 60 * 1000;
  const ranked = rankOpportunities(profile, candidates).filter((match) => match.score >= NOTIFICATION_LIMITS.minScore);

  const items: DigestItem[] = [];
  for (const match of ranked) {
    const types: DigestItem["types"] = [];
    const createdAt = new Date(match.opportunity.created_at).getTime();
    const deadline = match.opportunity.deadline ? new Date(`${match.opportunity.deadline}T23:59:59Z`).getTime() : null;
    const daysToDeadline = deadline === null ? null : (deadline - now.getTime()) / DAY_MS;
    if (createdAt >= cutoff && !logged.has(`${match.opportunity.id}:new_match`)) types.push("new_match");
    if (daysToDeadline !== null && daysToDeadline >= 0 && daysToDeadline <= NOTIFICATION_LIMITS.deadlineDays && !logged.has(`${match.opportunity.id}:deadline_reminder`)) {
      types.push("deadline_reminder");
    }
    if (types.length) items.push({ match, types });
    if (items.length >= NOTIFICATION_LIMITS.maxItemsPerDigest) break;
  }

  return items.length ? { user: profile, items } : null;
}

export async function markDigestSent(admin: AdminClient, digest: NotificationDigest) {
  const rows = digest.items.flatMap((item) =>
    item.types.map((type) => ({
      user_id: digest.user.id,
      opportunity_id: item.match.opportunity.id,
      notification_type: type,
    })),
  );
  if (!rows.length) return;
  const { error } = await admin.from("notification_logs").insert(rows);
  if (error && error.code !== "23505") throw error;
}
