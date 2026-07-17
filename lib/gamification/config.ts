import type { OpportunityCategory } from "@/lib/database.types";
import {
  ACTION_XP,
  type GamificationAction,
} from "../progress/xpPolicy";
import {
  LEVEL_CAP,
  levelFromXp,
  levelProgress,
  titleForLevel,
  xpForLevel,
} from "../progress/levelPolicy";

export { ACTION_XP, LEVEL_CAP, levelFromXp, levelProgress, titleForLevel, xpForLevel };
export type { GamificationAction };

export const CATEGORY_MASTERY_LABELS: Record<OpportunityCategory, string> = {
  startup_grant: "Startup Grant Mastery",
  pitch_competition: "Pitch Competition Mastery",
  accelerator: "Accelerator Mastery",
  hackathon: "Hackathon Mastery",
  founder_fellowship: "Founder Fellowship Mastery",
  small_business_rebate: "Small Business Rebate Mastery",
};

export const CATEGORY_ACTION_XP: Record<GamificationAction, number> = {
  profile_completed: 0,
  email_verified: 0,
  opportunity_viewed: 0,
  opportunity_saved: 0,
  opportunity_applied: 0,
  opportunity_won: 0,
  friend_invited: 0,
  daily_quest_completed: 0,
  streak_maintained: 0,
  profile_updated: 0,
  challenge_joined: 0,
  challenge_completed: 0,
  collection_completed: 0,
  reward_bonus: 0,
  founder_report_generated: 0,
  founder_project_launched: 0,
  execution_output_saved: 0,
};

export function categoryLevelFromXp(categoryXp: number) {
  return Math.max(1, Math.floor(Math.sqrt(categoryXp / 100)) + 1);
}

export const PROFILE_COMPLETION_FIELDS = [
  ["name", "Name"],
  ["age", "Age"],
  ["state", "State"],
  ["income_range", "Income range"],
  ["student_status", "Student status"],
  ["occupation", "Occupation"],
  ["interests", "Interests"],
  ["goals", "Goals"],
  ["resume_link", "Resume link"],
  ["education_level", "Education level"],
] as const;

export const PROFILE_MILESTONES = [
  { percent: 25, xp: 25 },
  { percent: 50, xp: 50 },
  { percent: 75, xp: 75 },
  { percent: 100, xp: 100 },
] as const;

export const ESTIMATED_VALUE_BY_CATEGORY: Record<OpportunityCategory, number> = {
  startup_grant: 10000,
  pitch_competition: 5000,
  accelerator: 25000,
  hackathon: 2500,
  founder_fellowship: 15000,
  small_business_rebate: 1500,
};
