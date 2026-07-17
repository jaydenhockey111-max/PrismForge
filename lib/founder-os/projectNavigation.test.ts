import { describe, expect, it } from "vitest";
import { PROJECT_SECTIONS, parseProjectSection } from "./projectNavigation";

describe("project workspace navigation", () => {
  it("uses the six founder operating systems", () => {
    expect(PROJECT_SECTIONS.map((section) => section.id)).toEqual(["today", "project", "validate", "ai-team", "progress", "launch"]);
  });

  it("defaults project workspaces to Today", () => {
    expect(parseProjectSection(undefined)).toBe("today");
    expect(parseProjectSection("unknown")).toBe("today");
  });

  it("preserves old Plan links by routing them to Project", () => {
    expect(parseProjectSection("plan")).toBe("project");
  });
});
