import { describe, expect, it } from "vitest";
import { createProjectValidationMessage } from "./createProjectFeedback";

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
