import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("focused PrismForge interface", () => {
  it("boots and exposes persistent light and dark themes", () => {
    const layout = source("app/layout.tsx");
    const styles = source("app/globals.css");
    const toggle = source("components/theme-toggle.tsx");

    expect(layout).toContain("prismforge-theme");
    expect(styles).toContain('html[data-theme="dark"]');
    expect(toggle).toContain("Switch to dark mode");
    expect(toggle).toContain("Switch to light mode");
  });

  it("keeps retired presentation layers out of the project workspace", () => {
    const project = source("app/(app)/projects/[id]/page.tsx");

    expect(project).not.toContain("StartupTeamWorkspace");
    expect(project).not.toContain("ExecutionSuite");
    expect(project).not.toContain("QuestPanel");
    expect(project).not.toContain("MarketPulse");
    expect(project).not.toContain("ProjectAlphaPanel");
    expect(project).not.toContain("RewardChest");
    expect(project).toContain("project-report-rail");
  });

  it("makes Review about evidence and decisions instead of activity scoring", () => {
    const review = source("app/(app)/progress/page.tsx");

    expect(review).toContain("CrossProjectLearning");
    expect(review).toContain("project_decisions");
    expect(review).not.toContain("levelProgress");
    expect(review).not.toContain("QuestPanel");
    expect(review).not.toContain('from("xp_events")');
    expect(review).not.toContain('from("streaks")');
  });
});
