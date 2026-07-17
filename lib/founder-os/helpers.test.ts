import { describe, expect, it } from "vitest";
import { cleanSentence, shortProjectName } from "./helpers";

describe("founder-os helper text cleanup", () => {
  it("shortens long descriptive project titles into usable product names", () => {
    expect(shortProjectName("An AI Study Coach That Helps High School Students Turn Homework, Notes, Weak Topics, And Tests Into A Plan")).toBe("AI Study Coach");
  });

  it("cleans curly quotes and common mojibake from generated text", () => {
    expect(cleanSentence("I\u00e2\u20ac\u2122m testing this \u00e2\u20ac\u201d does it help?")).toBe("I'm testing this - does it help?");
  });
});
