import { describe, expect, it } from "vitest";
import {
  cleanGeneratedCopy,
  cleanGeneratedList,
  cleanGeneratedMarkdown,
  cleanHeading,
  renderCopyTemplate,
  validateLanguage,
  withArticle,
} from "./copyQuality";

describe("PrismForge Language Engine", () => {
  it("repairs broken AI articles and repeated AI nouns", () => {
    expect(cleanGeneratedCopy("A AI tool AI assistant for students.")).toBe("An AI assistant for students.");
    expect(withArticle("AI study assistant")).toBe("an AI study assistant");
  });

  it("removes duplicated adjacent phrases and audience repetition", () => {
    expect(cleanGeneratedCopy("high school students high school students need a plan plan.")).toBe("High school students need a plan.");
  });

  it("rewrites jargon into plain English", () => {
    expect(cleanGeneratedCopy("Confirm Pain with customer discovery and validation signal.")).toBe("Validate the problem with talk to potential users and evidence collected.");
  });

  it("cleans headings without leaving truncated fragments", () => {
    expect(cleanHeading("# UI/UX Wireframe Map: An AI Study Coach That Helps High School Students Turn Homework And T", 58)).not.toMatch(/\bT$/);
  });

  it("keeps markdown structure while cleaning each line", () => {
    const markdown = cleanGeneratedMarkdown("# A AI tool AI assistant\n\n- Confirm Pain\n- students students");

    expect(markdown).toContain("# An AI assistant");
    expect(markdown).toContain("- Validate the problem");
    expect(markdown).toContain("- Students");
  });

  it("deduplicates generated lists", () => {
    expect(cleanGeneratedList(["Talk to users", "Talk to users", "A AI assistant"])).toEqual(["Talk to users", "An AI assistant"]);
  });

  it("renders templates safely instead of concatenating blindly", () => {
    expect(renderCopyTemplate("Build {{thing}} for {{audience}} {{audience}}.", { thing: "A AI planner", audience: "students" })).toBe("Build an AI planner for students.");
  });

  it("reports language issues for observability and regression checks", () => {
    const issues = validateLanguage("A AI tool AI assistant empowers users to leverage leverage.");

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["broken_article", "ai_sounding_phrase"]));
  });
});
