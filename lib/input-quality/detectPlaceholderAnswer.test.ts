import { describe, expect, it } from "vitest";
import { detectPlaceholderAnswer } from "./detectPlaceholderAnswer";

describe("detectPlaceholderAnswer", () => {
  it.each(["no idea", "no clue", "idk", "whatever", "I don't know", "n/a", "surprise me", "you choose", "???", "...", "asdf asdf asdf"])("%s is placeholder", (value) => {
    expect(detectPlaceholderAnswer(value, "idea").isPlaceholder).toBe(true);
  });

  it("does not reject legitimate no-code wording", () => {
    expect(detectPlaceholderAnswer("No-code study planner", "idea").isPlaceholder).toBe(false);
  });

  it("does not reject a meaningful sentence containing no idea", () => {
    expect(detectPlaceholderAnswer("I have no idea how students organize homework", "idea").isPlaceholder).toBe(false);
  });

  it("treats punctuation-only values as placeholder", () => {
    const detection = detectPlaceholderAnswer("   ???   ", "targetAudience");
    expect(detection.isPlaceholder).toBe(true);
    expect(detection.reason).toBe("punctuation_only");
  });
});
