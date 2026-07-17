import { describe, expect, it } from "vitest";
import { levelFromXp, levelProgress, titleForLevel, xpForLevel } from "./config";

describe("gamification level system", () => {
  it("uses a steep founder XP curve and milestone titles", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(80);
    expect(xpForLevel(5)).toBe(1040);
    expect(xpForLevel(10)).toBe(4661);
    expect(levelFromXp(1040)).toBe(5);
    expect(titleForLevel(10)).toBe("Builder");
  });

  it("calculates progress to the next level", () => {
    const progress = levelProgress(40);
    expect(progress.level).toBe(1);
    expect(progress.progress).toBe(50);
    expect(progress.nextLevelXp).toBe(80);
    expect(progress.nextReward).toBe("Explorer profile marker at Level 2");
  });
});
