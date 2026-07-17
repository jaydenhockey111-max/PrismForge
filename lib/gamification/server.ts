import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACTION_XP,
  CATEGORY_ACTION_XP,
  categoryLevelFromXp,
  ESTIMATED_VALUE_BY_CATEGORY,
  levelFromXp,
  PROFILE_COMPLETION_FIELDS,
  PROFILE_MILESTONES,
  titleForLevel,
  type GamificationAction,
} from "@/lib/gamification/config";
import type { Badge, Challenge, Collection, Json, Opportunity, OpportunityCategory, Profile } from "@/lib/database.types";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MatchResult } from "@/lib/matching";

type AdminClient = SupabaseClient<Database>;

type TrackInput = {
  userId: string;
  action: GamificationAction;
  opportunityId?: string;
  category?: OpportunityCategory;
  idempotencyKey?: string;
  metadata?: Record<string, Json | undefined>;
};

export type GamificationDashboard = Awaited<ReturnType<typeof getGamificationDashboard>>;
export type GrantedReward = { name: string; description: string; rewardKey: string; expiresAt: string | null };

export async function trackUserAction(input: TrackInput) {
  const admin = createAdminClient();
  await ensureGamificationState(admin, input.userId);

  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from("xp_events")
      .select("id")
      .eq("user_id", input.userId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return { duplicate: true };
  }

  const opportunity = input.opportunityId ? await getOpportunity(admin, input.opportunityId) : null;
  const category = input.category ?? opportunity?.category ?? null;
  const xp = ACTION_XP[input.action] ?? 0;

  if (opportunity) await updateUserOpportunity(admin, input.userId, opportunity, input.action);

  const levelResult = await addXpEvent(admin, {
    userId: input.userId,
    action: input.action,
    xp,
    opportunityId: opportunity?.id,
    category,
    idempotencyKey: input.idempotencyKey,
    metadata: { ...input.metadata, estimated_value: opportunity?.estimated_value ?? undefined } as Record<string, Json | undefined>,
  });

  await updateStreak(admin, input.userId);
  await updateDailyQuestProgress(admin, input.userId, input.action, opportunity);
  if (category) {
    await updateCategoryMastery(admin, input.userId, category, CATEGORY_ACTION_XP[input.action] ?? 0);
    await updateCollections(admin, input.userId, category);
  }
  await updateMoneyStats(admin, input.userId);
  await updateChallengeProgress(admin, input.userId, input.action, opportunity);
  await checkBadges(admin, input.userId);

  const rewards: GrantedReward[] = [];
  if (levelResult.leveledUp) {
    const reward = await grantMysteryReward(admin, input.userId, `level_up_${levelResult.levelAfter}`);
    if (reward) rewards.push(reward);
  }
  if (input.action === "opportunity_won") {
    const reward = await grantMysteryReward(admin, input.userId, "opportunity_won");
    if (reward) rewards.push(reward);
  }

  return { duplicate: false, ...levelResult, rewards };
}

export async function updateProfileCompletion(userId: string, profile?: Profile) {
  const admin = createAdminClient();
  await ensureGamificationState(admin, userId);
  const currentProfile = profile ?? await getProfile(admin, userId);
  if (!currentProfile) return null;
  const completion = calculateProfileCompletion(currentProfile);

  const { data: existing } = await admin
    .from("profile_completion")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const awarded = new Set(existing?.awarded_milestones ?? []);
  const newlyAwarded: number[] = [];

  for (const milestone of PROFILE_MILESTONES) {
    if (completion.percent >= milestone.percent && !awarded.has(milestone.percent)) {
      await addXpEvent(admin, {
        userId,
        action: "profile_completed",
        xp: 0,
        idempotencyKey: `profile_completion:${milestone.percent}`,
        metadata: { milestone: milestone.percent },
      });
      awarded.add(milestone.percent);
      newlyAwarded.push(milestone.percent);
    }
  }

  if (completion.percent === 100) {
    await addXpEvent(admin, {
      userId,
      action: "profile_completed",
      xp: ACTION_XP.profile_completed,
      idempotencyKey: "profile_completed:100",
      metadata: { profile_complete: true },
    });
  }

  await admin.from("profile_completion").upsert({
    user_id: userId,
    completion_percent: completion.percent,
    completed_fields: completion.completed,
    missing_fields: completion.missing,
    awarded_milestones: [...awarded].sort((a, b) => a - b),
    updated_at: new Date().toISOString(),
  });

  await trackUserAction({ userId, action: "profile_updated", idempotencyKey: `profile_updated:${todayKey()}` });
  if (newlyAwarded.length) await checkBadges(admin, userId);
  return completion;
}

export async function ensureDailyQuests(userId: string) {
  const admin = createAdminClient();
  await ensureGamificationState(admin, userId);
  const date = todayKey();
  const { data: existing, error: existingError } = await admin
    .from("user_daily_quests")
    .select("*")
    .eq("user_id", userId)
    .eq("quest_date", date)
    .order("created_at", { ascending: true });
  if (existingError) throw existingError;
  if ((existing ?? []).length >= 3) return existing ?? [];

  const { data: templates, error: templateError } = await admin
    .from("daily_quests")
    .select("*")
    .eq("active", true)
    .order("quest_key", { ascending: true });
  if (templateError) throw templateError;

  const already = new Set((existing ?? []).map((quest) => quest.daily_quest_id));
  const selected = deterministicPick(templates ?? [], `${userId}:${date}`, 3).filter((quest) => !already.has(quest.id));
  if (!selected.length) return existing ?? [];

  const expiresAt = new Date(`${date}T23:59:59.999Z`).toISOString();
  const rows = selected.map((quest) => ({
    user_id: userId,
    quest_date: date,
    daily_quest_id: quest.id,
    title: quest.title,
    description: quest.description,
    action_type: quest.action_type,
    target_count: quest.target_count,
    xp_reward: quest.xp_reward,
    expires_at: expiresAt,
  }));
  const { error: insertError } = await admin.from("user_daily_quests").insert(rows);
  if (insertError && insertError.code !== "23505") throw insertError;

  const { data } = await admin
    .from("user_daily_quests")
    .select("*")
    .eq("user_id", userId)
    .eq("quest_date", date)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getGamificationDashboard(profile: Profile, matches: MatchResult[]) {
  const admin = createAdminClient();
  try {
    await ensureGamificationState(admin, profile.id);
    await trackUserAction({ userId: profile.id, action: "email_verified", idempotencyKey: "email_verified" });
    const profileCompletion = await updateProfileCompletion(profile.id, profile);
    await ensureDailyQuests(profile.id);
    await updatePotentialValue(admin, profile.id, matches);

    const [
      { data: xp },
      { data: streak },
      { data: quests },
      { data: badges },
      { data: userBadges },
      { data: rewards },
      { data: mastery },
      { data: collections },
      { data: userCollections },
      { data: moneyStats },
      { data: userOpportunities },
      { data: challenges },
      { data: challengeMembers },
      { data: challengeProgress },
    ] = await Promise.all([
      admin.from("user_xp").select("*").eq("user_id", profile.id).single(),
      admin.from("streaks").select("*").eq("user_id", profile.id).single(),
      admin.from("user_daily_quests").select("*").eq("user_id", profile.id).eq("quest_date", todayKey()).order("created_at", { ascending: true }),
      admin.from("badges").select("*").eq("active", true).order("name", { ascending: true }),
      admin.from("user_badges").select("*").eq("user_id", profile.id),
      admin.from("user_rewards").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(5),
      admin.from("category_mastery").select("*").eq("user_id", profile.id),
      admin.from("collections").select("*").eq("active", true).order("name", { ascending: true }),
      admin.from("user_collections").select("*").eq("user_id", profile.id),
      admin.from("money_found_stats").select("*").eq("user_id", profile.id).single(),
      admin.from("user_opportunities").select("*").eq("user_id", profile.id),
      admin.from("challenges").select("*").eq("active", true).order("created_at", { ascending: true }),
      admin.from("challenge_members").select("*").eq("user_id", profile.id),
      admin.from("challenge_progress").select("*").eq("user_id", profile.id),
    ]);

    return {
      available: true as const,
      xp,
      streak,
      quests: quests ?? [],
      badges: buildBadgeView(badges ?? [], userBadges ?? []),
      rewards: rewards ?? [],
      mastery: mastery ?? [],
      profileCompletion: profileCompletion ?? calculateProfileCompletion(profile),
      collections: (collections ?? []).map((collection) => ({
        ...collection,
        user: (userCollections ?? []).find((item) => item.collection_id === collection.id) ?? null,
      })),
      moneyStats,
      userOpportunities: userOpportunities ?? [],
      challenges: (challenges ?? []).map((challenge) => ({
        ...challenge,
        joined: (challengeMembers ?? []).some((member) => member.challenge_id === challenge.id),
        progress: (challengeProgress ?? []).find((item) => item.challenge_id === challenge.id) ?? null,
      })),
    };
  } catch (error) {
    return {
      available: false as const,
      error: error instanceof Error ? error.message : "Gamification is not ready yet.",
      xp: null,
      streak: null,
      quests: [],
      badges: [],
      rewards: [],
      mastery: [],
      profileCompletion: calculateProfileCompletion(profile),
      collections: [],
      moneyStats: null,
      userOpportunities: [],
      challenges: [],
    };
  }
}

export async function joinChallenge(userId: string, challengeId: string) {
  const admin = createAdminClient();
  await ensureGamificationState(admin, userId);
  const { error } = await admin.from("challenge_members").upsert({ challenge_id: challengeId, user_id: userId });
  if (error) throw error;
  await admin.from("challenge_progress").upsert({ challenge_id: challengeId, user_id: userId });
  await trackUserAction({ userId, action: "challenge_joined", idempotencyKey: `challenge_joined:${challengeId}` });
}

function calculateProfileCompletion(profile: Profile) {
  const completed: string[] = [];
  const missing: string[] = [];
  for (const [key, label] of PROFILE_COMPLETION_FIELDS) {
    const value = profile[key as keyof Profile];
    const filled = Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim().length > 0;
    (filled ? completed : missing).push(label);
  }
  return { percent: Math.round((completed.length / PROFILE_COMPLETION_FIELDS.length) * 100), completed, missing };
}

async function ensureGamificationState(admin: AdminClient, userId: string) {
  await Promise.all([
    admin.from("user_xp").upsert({ user_id: userId }, { onConflict: "user_id" }),
    admin.from("streaks").upsert({ user_id: userId }, { onConflict: "user_id" }),
    admin.from("money_found_stats").upsert({ user_id: userId }, { onConflict: "user_id" }),
    admin.from("profile_completion").upsert({ user_id: userId }, { onConflict: "user_id" }),
  ]);
}

async function addXpEvent(
  admin: AdminClient,
  input: { userId: string; action: string; xp: number; opportunityId?: string | null; category?: OpportunityCategory | null; idempotencyKey?: string; metadata?: Record<string, Json | undefined> },
) {
  const rpcResult = await addXpEventAtomically(admin, input);
  if (rpcResult) return rpcResult;

  const { data: current, error: currentError } = await admin.from("user_xp").select("*").eq("user_id", input.userId).single();
  if (currentError) throw currentError;
  const multiplier = current.xp_multiplier_until && new Date(current.xp_multiplier_until).getTime() > Date.now() ? 2 : 1;
  const xpDelta = Math.max(0, Math.round(input.xp * multiplier));

  const { error: insertError } = await admin.from("xp_events").insert({
    user_id: input.userId,
    action: input.action,
    xp_delta: xpDelta,
    opportunity_id: input.opportunityId ?? null,
    category: input.category ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    metadata: removeUndefined({ ...(input.metadata ?? {}), multiplier }) as Json,
  });
  if (insertError) {
    if (insertError.code === "23505") return { inserted: false, leveledUp: false, levelBefore: current.level, levelAfter: current.level };
    throw insertError;
  }

  const nextTotal = current.total_xp + xpDelta;
  const nextLevel = levelFromXp(nextTotal);
  const nextTitle = titleForLevel(nextLevel);
  const { error: updateError } = await admin.from("user_xp").update({ total_xp: nextTotal, level: nextLevel, title: nextTitle }).eq("user_id", input.userId);
  if (updateError) throw updateError;
  return { inserted: true, leveledUp: nextLevel > current.level, levelBefore: current.level, levelAfter: nextLevel };
}

async function addXpEventAtomically(
  admin: AdminClient,
  input: { userId: string; action: string; xp: number; opportunityId?: string | null; category?: OpportunityCategory | null; idempotencyKey?: string; metadata?: Record<string, Json | undefined> },
) {
  const rpcAdmin = admin as any;
  const { data, error } = await rpcAdmin.rpc("record_xp_event", {
    p_user_id: input.userId,
    p_action: input.action,
    p_xp: input.xp,
    p_opportunity_id: input.opportunityId ?? null,
    p_category: input.category ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_metadata: removeUndefined({ ...(input.metadata ?? {}) }),
  });
  if (error) {
    const missingFunction = error.code === "42883" || error.code === "PGRST202" || String(error.message ?? "").includes("record_xp_event");
    if (missingFunction) return null;
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    inserted: Boolean(row.inserted),
    leveledUp: Number(row.level_after) > Number(row.level_before),
    levelBefore: Number(row.level_before),
    levelAfter: Number(row.level_after),
  };
}

async function updateStreak(admin: AdminClient, userId: string) {
  const date = todayKey();
  const yesterday = dayKey(-1);
  const { data: streak, error } = await admin.from("streaks").select("*").eq("user_id", userId).single();
  if (error) throw error;
  if (streak.last_active_date === date) return;

  const continued = streak.last_active_date === yesterday;
  const current = continued ? streak.current_streak + 1 : 1;
  const longest = Math.max(streak.longest_streak, current);
  const { error: updateError } = await admin.from("streaks").update({ current_streak: current, longest_streak: longest, last_active_date: date }).eq("user_id", userId);
  if (updateError) throw updateError;
  if (continued) {
    await addXpEvent(admin, { userId, action: "streak_maintained", xp: ACTION_XP.streak_maintained, idempotencyKey: `streak:${date}`, metadata: { current_streak: current } });
  }
  if (current >= 7) await grantMysteryReward(admin, userId, "streak_7");
}

async function updateDailyQuestProgress(admin: AdminClient, userId: string, action: GamificationAction, opportunity: Opportunity | null) {
  const quests = await ensureDailyQuests(userId);
  const matching = quests.filter((quest) => quest.action_type === action && !quest.completed_at);
  for (const quest of matching) {
    const config = (quest as { config?: Json }).config as Record<string, unknown> | undefined;
    if (config?.requires_deadline && !opportunity?.deadline) continue;
    const nextProgress = Math.min(quest.target_count, quest.progress + 1);
    const completed = nextProgress >= quest.target_count;
    const { error } = await admin.from("user_daily_quests").update({
      progress: nextProgress,
      completed_at: completed ? new Date().toISOString() : null,
    }).eq("id", quest.id).is("completed_at", null);
    if (error) throw error;
    if (completed) {
      await addXpEvent(admin, { userId, action: "daily_quest_completed", xp: 0, idempotencyKey: `legacy_daily_quest:${quest.id}`, metadata: { quest: quest.title, legacy_no_xp: true } });
      const completedCount = await countEvents(admin, userId, "daily_quest_completed");
      if (completedCount > 0 && completedCount % 5 === 0) await grantMysteryReward(admin, userId, `daily_quests_${completedCount}`);
    }
  }
}

async function updateCategoryMastery(admin: AdminClient, userId: string, category: OpportunityCategory, amount: number) {
  if (amount <= 0) return;
  const { data: current } = await admin.from("category_mastery").select("*").eq("user_id", userId).eq("category", category).maybeSingle();
  const xp = (current?.category_xp ?? 0) + amount;
  await admin.from("category_mastery").upsert({ user_id: userId, category, category_xp: xp, level: categoryLevelFromXp(xp), updated_at: new Date().toISOString() });
}

async function updateCollections(admin: AdminClient, userId: string, category: OpportunityCategory) {
  const { data: collections } = await admin.from("collections").select("*").eq("category", category).eq("active", true);
  const { data: touched } = await admin.from("user_opportunities").select("opportunity_id").eq("user_id", userId);
  const ids = [...new Set((touched ?? []).map((row) => row.opportunity_id))];
  const { count } = ids.length
    ? await admin.from("opportunities").select("*", { count: "exact", head: true }).in("id", ids).eq("category", category)
    : { count: 0 };
  for (const collection of collections ?? []) {
    const progress = Math.min(collection.target_count, count ?? 0);
    const completed = progress >= collection.target_count;
    const { data: existing } = await admin.from("user_collections").select("*").eq("user_id", userId).eq("collection_id", collection.id).maybeSingle();
    await admin.from("user_collections").upsert({
      user_id: userId,
      collection_id: collection.id,
      progress_count: progress,
      completed_at: completed ? existing?.completed_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (completed && !existing?.completed_at) {
      await addXpEvent(admin, { userId, action: "collection_completed", xp: 0, idempotencyKey: `legacy_collection:${collection.id}`, metadata: { collection: collection.name, legacy_no_xp: true } });
    }
  }
}

async function updateMoneyStats(admin: AdminClient, userId: string) {
  const { data } = await admin.from("user_opportunities").select("saved_at,applied_at,won_at,opportunity_id").eq("user_id", userId);
  const ids = [...new Set((data ?? []).map((row) => row.opportunity_id))];
  const { data: opportunities } = ids.length
    ? await admin.from("opportunities").select("id,estimated_value").in("id", ids)
    : { data: [] as Pick<Opportunity, "id" | "estimated_value">[] };
  const byId = new Map((opportunities ?? []).map((opportunity) => [opportunity.id, Number(opportunity.estimated_value ?? 0)]));
  let saved = 0; let applied = 0; let won = 0;
  for (const row of data ?? []) {
    const value = byId.get(row.opportunity_id) ?? 0;
    if (row.saved_at) saved += value;
    if (row.applied_at) applied += value;
    if (row.won_at) won += value;
  }
  await admin.from("money_found_stats").upsert({
    user_id: userId,
    total_saved_value: saved,
    total_applied_value: applied,
    total_won_value: won,
    updated_at: new Date().toISOString(),
  });
}

async function updatePotentialValue(admin: AdminClient, userId: string, matches: MatchResult[]) {
  const total = matches.reduce((sum, match) => sum + Number(match.opportunity.estimated_value ?? ESTIMATED_VALUE_BY_CATEGORY[match.opportunity.category] ?? 0), 0);
  await admin.from("money_found_stats").upsert({ user_id: userId, total_potential_value: total, updated_at: new Date().toISOString() });
}

async function updateChallengeProgress(admin: AdminClient, userId: string, action: GamificationAction, opportunity: Opportunity | null) {
  const { data: memberships } = await admin.from("challenge_members").select("challenge_id").eq("user_id", userId);
  if (!memberships?.length) return;
  const { data: challenges } = await admin.from("challenges").select("*").in("id", memberships.map((item) => item.challenge_id));
  for (const challenge of challenges ?? []) {
    const increment = challengeIncrement(challenge, action, opportunity);
    if (increment <= 0) continue;
    const { data: current } = await admin.from("challenge_progress").select("*").eq("challenge_id", challenge.id).eq("user_id", userId).maybeSingle();
    const next = Math.min(challenge.goal_target, (current?.progress_count ?? 0) + increment);
    const completed = next >= challenge.goal_target;
    await admin.from("challenge_progress").upsert({
      challenge_id: challenge.id,
      user_id: userId,
      progress_count: next,
      score_xp: (current?.score_xp ?? 0) + (ACTION_XP[action] ?? 0),
      completed_at: completed ? current?.completed_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (completed && !current?.completed_at) {
      await addXpEvent(admin, { userId, action: "challenge_completed", xp: 0, idempotencyKey: `legacy_challenge:${challenge.id}`, metadata: { challenge: challenge.title, legacy_no_xp: true } });
      await grantMysteryReward(admin, userId, `challenge_completed_${challenge.id}`);
    }
  }
}

function challengeIncrement(challenge: Challenge, action: GamificationAction, opportunity: Opportunity | null) {
  if (["founder_fellowship_actions", "scholarship_actions"].includes(challenge.goal_type) && opportunity?.category === "founder_fellowship" && action.startsWith("opportunity_")) return 1;
  if (["accelerator_applications", "internship_applications"].includes(challenge.goal_type) && opportunity?.category === "accelerator" && action === "opportunity_applied") return 1;
  if (challenge.goal_type === "money_found" && opportunity && (action === "opportunity_saved" || action === "opportunity_applied")) return Number(opportunity.estimated_value ?? 0);
  return 0;
}

async function checkBadges(admin: AdminClient, userId: string) {
  const { data: badges } = await admin.from("badges").select("*").eq("active", true);
  const { data: unlocked } = await admin.from("user_badges").select("badge_id").eq("user_id", userId);
  const unlockedIds = new Set((unlocked ?? []).map((badge) => badge.badge_id));
  const { data: streak } = await admin.from("streaks").select("*").eq("user_id", userId).single();
  const { data: mastery } = await admin.from("category_mastery").select("*").eq("user_id", userId);

  for (const badge of badges ?? []) {
    if (unlockedIds.has(badge.id)) continue;
    if (await badgeUnlocked(admin, userId, badge, streak?.current_streak ?? 0, mastery ?? [])) {
      await admin.from("user_badges").insert({ user_id: userId, badge_id: badge.id });
    }
  }
}

async function badgeUnlocked(admin: AdminClient, userId: string, badge: Badge, streak: number, mastery: { category: string; level: number }[]) {
  const condition = (badge.unlock_condition ?? {}) as Record<string, unknown>;
  if (typeof condition.action === "string" && typeof condition.count === "number") {
    return await countEvents(admin, userId, condition.action) >= condition.count;
  }
  if (typeof condition.streak === "number") return streak >= condition.streak;
  if (typeof condition.category === "string" && typeof condition.level === "number") {
    return (mastery ?? []).some((item) => item.category === condition.category && item.level >= Number(condition.level));
  }
  return false;
}

async function grantMysteryReward(admin: AdminClient, userId: string, trigger: string) {
  const idempotencyKey = `reward:${trigger}`;
  const { data: existing } = await admin.from("user_rewards").select("id").eq("user_id", userId).eq("trigger", idempotencyKey).maybeSingle();
  if (existing) return null;
  const { data: rewards } = await admin.from("mystery_rewards").select("*").eq("active", true);
  if (!rewards?.length) return null;
  const reward = weightedPick(rewards);
  const metadata = (reward.metadata ?? {}) as Record<string, Json>;
  const durationDays = typeof metadata.duration_days === "number" ? metadata.duration_days : null;
  const durationHours = typeof metadata.duration_hours === "number" ? metadata.duration_hours : null;
  const expiresAt = reward.reward_key.startsWith("double_xp") || reward.reward_key.startsWith("premium_trial")
    ? new Date(Date.now() + ((durationDays ?? (durationHours ? durationHours / 24 : 7)) * 24 * 60 * 60 * 1000)).toISOString()
    : null;

  const { error: insertError } = await admin.from("user_rewards").insert({
    user_id: userId,
    mystery_reward_id: reward.id,
    reward_key: reward.reward_key,
    name: reward.name,
    description: reward.description,
    trigger: idempotencyKey,
    metadata: reward.metadata,
    expires_at: expiresAt,
  });
  if (insertError) {
    if (insertError.code === "23505") return null;
    throw insertError;
  }

  if (reward.reward_key.startsWith("double_xp") && expiresAt) {
    const { data: xp } = await admin.from("user_xp").select("xp_multiplier_until").eq("user_id", userId).single();
    await admin.from("user_xp").update({ xp_multiplier_until: laterIso(xp?.xp_multiplier_until, expiresAt) }).eq("user_id", userId);
  }
  if (reward.reward_key.startsWith("premium_trial") && expiresAt) {
    const { data: xp } = await admin.from("user_xp").select("premium_trial_until").eq("user_id", userId).single();
    await admin.from("user_xp").update({ premium_trial_until: laterIso(xp?.premium_trial_until, expiresAt) }).eq("user_id", userId);
  }
  if (reward.reward_key.startsWith("bonus_xp")) {
    const bonusXp = typeof metadata.bonus_xp === "number" ? metadata.bonus_xp : Number(reward.reward_key.match(/\d+/)?.[0] ?? 250);
    await addXpEvent(admin, {
      userId,
      action: "reward_bonus",
      xp: 0,
      idempotencyKey: `reward_bonus:${trigger}`,
      metadata: { reward: reward.name, legacy_no_xp: true, requested_bonus_xp: Math.max(0, Math.min(10_000, bonusXp)) },
    });
  }
  if (reward.reward_key === "streak_freeze") {
    const { data: xp } = await admin.from("user_xp").select("streak_freezes").eq("user_id", userId).single();
    await admin.from("user_xp").update({ streak_freezes: (xp?.streak_freezes ?? 0) + 1 }).eq("user_id", userId);
  }
  return { name: reward.name, description: reward.description, rewardKey: reward.reward_key, expiresAt } satisfies GrantedReward;
}

function laterIso(current: string | null | undefined, next: string) {
  if (!current) return next;
  return new Date(current).getTime() > new Date(next).getTime() ? current : next;
}

async function updateUserOpportunity(admin: AdminClient, userId: string, opportunity: Opportunity, action: GamificationAction) {
  const now = new Date().toISOString();
  const payload: Record<string, string> = { last_action_at: now };
  if (action === "opportunity_viewed") payload.viewed_at = now;
  if (action === "opportunity_saved") payload.saved_at = now;
  if (action === "opportunity_applied") payload.applied_at = now;
  if (action === "opportunity_won") payload.won_at = now;
  await admin.from("user_opportunities").upsert({ user_id: userId, opportunity_id: opportunity.id, ...payload }, { onConflict: "user_id,opportunity_id" });
}

async function getOpportunity(admin: AdminClient, id: string) {
  const { data, error } = await admin.from("opportunities").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function getProfile(admin: AdminClient, id: string) {
  const { data } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
  return data;
}

async function countEvents(admin: AdminClient, userId: string, action: string) {
  const { count, error } = await admin.from("xp_events").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("action", action);
  if (error) throw error;
  return count ?? 0;
}

function buildBadgeView(badges: Badge[], userBadges: { badge_id: string; unlocked_at: string }[]) {
  const unlocked = new Map(userBadges.map((badge) => [badge.badge_id, badge.unlocked_at]));
  return badges.map((badge) => ({ ...badge, unlockedAt: unlocked.get(badge.id) ?? null }));
}

function deterministicPick<T>(items: T[], seed: string, count: number) {
  return [...items]
    .map((item, index) => ({ item, score: hash(`${seed}:${index}`) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(({ item }) => item);
}

function weightedPick<T extends { weight: number }>(items: T[]) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[0];
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index++) result = (result * 31 + value.charCodeAt(index)) >>> 0;
  return result;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dayKey(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function removeUndefined(value: Record<string, Json | undefined>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
