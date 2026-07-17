import { describe, expect, it } from "vitest";
import { cleanProjectTitle, deriveFallbackProjectTitle, getSafeDisplayProjectTitle, isWeakProjectTitle, validateProjectTitle } from "./titleQuality";

describe("project title quality", () => {
  it("repairs unfinished founder input titles", () => {
    const result = cleanProjectTitle("I want to create a", {
      audience: "high school students",
      painPoint: "turning homework notes into better study plans",
      businessType: "ai_tool",
      interests: "study, homework, notes",
    });

    expect(result.repaired).toBe(true);
    expect(result.title).toBe("Student Study Coach");
  });

  it("shortens long sentence ideas into credible product names", () => {
    const result = cleanProjectTitle("An AI Study Coach That Helps High School Students Turn Homework, Notes, Weak Topics, And Tests Into Study Plans");

    expect(result.title).toBe("AI Study Coach");
    expect(isWeakProjectTitle(result.title)).toBe(false);
  });

  it("keeps already-credible names", () => {
    const result = cleanProjectTitle("Golf Practice Planner");

    expect(result.repaired).toBe(false);
    expect(result.title).toBe("Golf Practice Planner");
  });

  it("strips common onboarding fragments without losing the useful concept", () => {
    expect(cleanProjectTitle("I want to create a golf practice planner").title).toBe("Golf Practice Planner");
    expect(cleanProjectTitle("My idea is a budgeting assistant").title).toBe("Budgeting Assistant");
    expect(cleanProjectTitle("An app for freelance invoicing").title).toBe("Freelance Invoicing App");
    expect(cleanProjectTitle("A tool for students").title).toBe("Students Tool");
  });

  it("falls back deterministically when the cleaned title is still unfinished", () => {
    const result = cleanProjectTitle("Build a", {
      audience: "creators",
      painPoint: "finding sponsors and brand deals",
      businessType: "digital_product",
    });

    expect(result.repaired).toBe(true);
    expect(result.title).toBe("Creator Sponsorship Toolkit");
  });

  it("normalizes punctuation, whitespace, quotes, casing, and acronyms", () => {
    expect(cleanProjectTitle("  “ai   crm!!!” ").title).toBe("AI CRM");
    expect(cleanProjectTitle("B2B SaaS Pricing Copilot").title).toBe("B2B SaaS Pricing Copilot");
    expect(cleanProjectTitle("creator---sponsor_tool").title).toBe("Creator Sponsor Tool");
  });

  it("rejects placeholders, copied prompts, and sentence-like feedback text", () => {
    expect(validateProjectTitle("Untitled").valid).toBe(false);
    expect(validateProjectTitle("New Project").valid).toBe(false);
    expect(validateProjectTitle("Could you give me blunt feedback on An AI Study Coach That Helps High School Students Turn Homework Into Plans?").valid).toBe(false);
    expect(validateProjectTitle("Create a").valid).toBe(false);
    expect(validateProjectTitle("!!!!!").valid).toBe(false);
  });

  it("derives useful fallback names from project context", () => {
    expect(deriveFallbackProjectTitle({ interests: "meal planning", audience: "busy families" })).toBe("Family Meal Planning Service");
    expect(deriveFallbackProjectTitle({ painPoint: "hockey practice tracking", audience: "young athletes" })).toBe("Athlete Training Planner");
    expect(deriveFallbackProjectTitle({ audience: "first-time founders", businessType: "ai_tool" })).toBe("Founder Launch Workspace");
  });

  it("uses safe display fallback for legacy invalid stored titles", () => {
    const title = getSafeDisplayProjectTitle({
      title: "I Want To Create A",
      business_type: "ai_tool",
      target_customer: "high school students",
      report_json: {
        summary: { title: "I Want To Create A", targetCustomer: "high school students", painPoint: "turning homework notes into study plans" },
        input: { interests: "study homework", businessType: "ai_tool" },
      },
    });

    expect(title).toBe("Student Study Coach");
  });

  it("preserves valid user-edited brand-like titles", () => {
    expect(cleanProjectTitle("PrismForge").title).toBe("PrismForge");
    expect(cleanProjectTitle("StudyMint").title).toBe("StudyMint");
    expect(isWeakProjectTitle("Creator Sponsorship Toolkit")).toBe(false);
  });
});
