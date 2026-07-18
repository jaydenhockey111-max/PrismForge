import { describe, expect, it } from "vitest";
import { PROJECT_SECTIONS, parseProjectSection } from "./projectNavigation";

describe("project workspace navigation", () => {
  it("keeps the project workspace focused on the evidence loop", () => {
    expect(PROJECT_SECTIONS.map((section) => section.id)).toEqual(["today", "project", "validate", "progress", "launch"]);
  });

  it("defaults project workspaces to Today", () => {
    expect(parseProjectSection(undefined)).toBe("today");
    expect(parseProjectSection("unknown")).toBe("today");
  });

  it("preserves old Plan links by routing them to Project", () => {
    expect(parseProjectSection("plan")).toBe("project");
  });

  it("safely retires old specialist links to Today", () => {
    expect(parseProjectSection("ai-team")).toBe("today");
  });
});
