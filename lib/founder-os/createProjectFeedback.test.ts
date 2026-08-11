import { describe, expect, it } from "vitest";
import { createProjectCreationProgressMessage, createProjectCreationSuccessMessage, createProjectValidationMessage, PROJECT_CREATION_SLOW_AFTER_MS } from "./createProjectFeedback";

describe("createProjectValidationMessage", () => {
  it("returns visible, plain-language guidance for required create-project fields", () => {
    expect(createProjectValidationMessage("interests")).toContain("interest");
    expect(createProjectValidationMessage("skills")).toContain("skill");
    expect(createProjectValidationMessage("targetAudience")).toContain("who");
  });

  it("falls back safely for unknown fields", () => {
    expect(createProjectValidationMessage("unknown_hidden_field")).toBe("Please fix the highlighted field before creating your project.");
  });
});

describe("project creation feedback", () => {
  it("keeps fast creation calm and does not imply fallback", () => {
    expect(createProjectCreationProgressMessage(false)).toContain("creating the project");
    expect(createProjectCreationProgressMessage(false)).not.toMatch(/fallback|local|AI generation took too long/i);
  });

  it("uses a calm slow state aligned with the maximum provider timeout", () => {
    expect(PROJECT_CREATION_SLOW_AFTER_MS).toBe(45_000);
    expect(createProjectCreationProgressMessage(true)).toBe("Still working — this is taking a little longer than usual.");
    expect(createProjectCreationProgressMessage(true)).not.toMatch(/fallback|local|error/i);
  });

  it("only describes the reliable starting version after confirmed fallback completion", () => {
    expect(createProjectCreationSuccessMessage(false)).toBe("Your project is ready. Start with your Next Move.");
    expect(createProjectCreationSuccessMessage(true)).toContain("reliable starting version");
  });
});
