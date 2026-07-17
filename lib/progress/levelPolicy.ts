export const LEVEL_CAP = 50;
export const LEVEL_BASE_XP = 80;
export const LEVEL_GROWTH_RATE = 1.85;

export type FounderStage = {
  name: "Explorer" | "Problem Investigator" | "Validator" | "Builder" | "Operator" | "Launcher" | "Revenue Builder" | "Experienced Founder";
  range: string;
  meaning: string;
};

export const FOUNDER_STAGES: Array<FounderStage & { minLevel: number }> = [
  { minLevel: 1, name: "Explorer", range: "Levels 1-2", meaning: "Defining a project and identifying what still needs to be tested." },
  { minLevel: 3, name: "Problem Investigator", range: "Levels 3-5", meaning: "Documenting assumptions and gathering early problem evidence." },
  { minLevel: 6, name: "Validator", range: "Levels 6-9", meaning: "Running experiments and recording external feedback." },
  { minLevel: 10, name: "Builder", range: "Levels 10-14", meaning: "Turning evidence into a focused, testable solution." },
  { minLevel: 15, name: "Operator", range: "Levels 15-20", meaning: "Repeatedly executing, learning, and making evidence-based decisions." },
  { minLevel: 21, name: "Launcher", range: "Levels 21-29", meaning: "Progressing projects toward launch-readiness or real-world release." },
  { minLevel: 30, name: "Revenue Builder", range: "Levels 30-39", meaning: "Recording meaningful payment intent, transactions, or revenue-related milestones." },
  { minLevel: 40, name: "Experienced Founder", range: "Level 40+", meaning: "Accumulating substantial documented execution across projects." },
];

export const LEVEL_REWARDS = [
  { level: 2, label: "Explorer profile marker", kind: "Recognition" },
  { level: 3, label: "Problem Investigator title", kind: "Recognition" },
  { level: 5, label: "Evidence-history presentation", kind: "Presentation" },
  { level: 6, label: "Validator title", kind: "Recognition" },
  { level: 10, label: "Builder title and workspace accent", kind: "Recognition" },
  { level: 15, label: "Operator title", kind: "Recognition" },
  { level: 21, label: "Launcher project-history marker", kind: "Presentation" },
  { level: 30, label: "Revenue Builder title", kind: "Recognition" },
  { level: 40, label: "Experienced Founder title", kind: "Recognition" },
] as const;

export function xpForLevel(level: number) {
  const safeLevel = Math.max(1, Math.min(LEVEL_CAP, Math.round(level)));
  if (safeLevel === 1) return 0;
  return Math.round(LEVEL_BASE_XP * Math.pow(safeLevel - 1, LEVEL_GROWTH_RATE));
}

export function stageForLevel(level: number) {
  const safeLevel = Math.max(1, Math.min(LEVEL_CAP, Math.round(level)));
  return [...FOUNDER_STAGES].reverse().find((stage) => safeLevel >= stage.minLevel) ?? FOUNDER_STAGES[0];
}

export function titleForLevel(level: number) {
  return stageForLevel(level).name;
}

export function rewardForLevel(level: number) {
  return [...LEVEL_REWARDS].reverse().find((reward) => level >= reward.level)?.label ?? "Founder progress record";
}

export function nextRewardForLevel(level: number) {
  const next = LEVEL_REWARDS.find((reward) => reward.level > level);
  return next ? `${next.label} at Level ${next.level}` : "All progression recognition unlocked";
}

export function levelFromXp(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(totalXp || 0));
  let level = 1;
  for (let candidate = 2; candidate <= LEVEL_CAP; candidate += 1) {
    if (safeXp < xpForLevel(candidate)) break;
    level = candidate;
  }
  return level;
}

export function levelProgress(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(totalXp || 0));
  const level = levelFromXp(safeXp);
  const current = xpForLevel(level);
  const next = level >= LEVEL_CAP ? current : xpForLevel(level + 1);
  const progress = next === current ? 100 : Math.max(0, Math.min(100, Math.round(((safeXp - current) / (next - current)) * 100)));
  const stage = stageForLevel(level);

  return {
    level,
    title: stage.name,
    meaning: stage.meaning,
    stageRange: stage.range,
    currentLevelXp: current,
    nextLevelXp: next,
    progress,
    currentReward: rewardForLevel(level),
    nextReward: nextRewardForLevel(level),
  };
}
