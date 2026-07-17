import { describe, expect, it } from "vitest";
import { betaCohorts, coreLoopPercent, deriveCoreLoopProgress, recommendationFingerprint } from "./coreLoop";

describe("core loop progress", () => {
  it("never completes from page views alone", () => {
    const progress = deriveCoreLoopProgress({
      projectExists: true,
      evidenceCount: 0,
      events: [
        { event_name: "core_loop_summary_viewed", created_at: "2026-07-16T10:00:00Z" },
        { event_name: "core_loop_assumption_viewed", created_at: "2026-07-16T10:01:00Z" },
        { event_name: "core_loop_next_action_viewed", created_at: "2026-07-16T10:02:00Z" },
      ],
    });
    expect(progress.coreLoopCompleted).toBe(false);
    expect(coreLoopPercent(progress)).toBe(50);
  });

  it("requires evidence and a changed recommendation", () => {
    const progress = deriveCoreLoopProgress({
      projectExists: true,
      evidenceCount: 1,
      events: [{ event_name: "core_loop_recommendation_updated", created_at: "2026-07-16T10:05:00Z" }],
    });
    expect(progress.evidenceRecorded).toBe(true);
    expect(progress.recommendationUpdated).toBe(true);
    expect(progress.coreLoopCompleted).toBe(true);
    expect(progress.completedAt).toBe("2026-07-16T10:05:00Z");
  });

  it("excludes synthetic projects from completion", () => {
    const progress = deriveCoreLoopProgress({
      projectExists: true,
      evidenceCount: 1,
      isSynthetic: true,
      events: [
        { event_name: "core_loop_recommendation_updated", created_at: "2026-07-16T10:05:00Z" },
        { event_name: "core_loop_completed", created_at: "2026-07-16T10:06:00Z" },
      ],
    });
    expect(progress.coreLoopCompleted).toBe(false);
  });
});

describe("core loop privacy-safe classification", () => {
  it("normalizes fingerprints without storing project content", () => {
    expect(recommendationFingerprint({ assumptionKey: "problem_priority", action: " Talk to 3 users ", evidenceType: "problem_interview" }))
      .toBe("problem_priority|talk to 3 users|problem_interview");
  });

  it("uses non-sensitive cohorts and isolates synthetic tests", () => {
    expect(betaCohorts({ businessType: "service", projectCreatedAt: "2026-07-16T12:00:00Z" })).toEqual(["new_core_loop_beta", "service_idea"]);
    expect(betaCohorts({ businessType: "ai_tool", projectCreatedAt: "2026-07-01T12:00:00Z", isSynthetic: true })[0]).toBe("synthetic_tester");
  });
});
