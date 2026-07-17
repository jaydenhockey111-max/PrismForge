import { describe, expect, it } from "vitest";
import { clientRequestId, sanitizeClientEventMetadata } from "@/lib/analytics/clientEventPolicy";

describe("client beta event policy", () => {
  it("removes private founder content while retaining structured fields", () => {
    const requestId = "12d8ed7a-dc62-4a03-98df-27eeb78f62d9";
    const metadata = sanitizeClientEventMetadata({
      project_id: "project-123",
      rating: "yes",
      follow_up: "The interview changed my pricing decision.",
      evidence_text: "Private interview notes",
      count: 2,
      permission: true,
      recommendation_more_useful: false,
    }, requestId);

    expect(metadata).toEqual({
      request_id: requestId,
      project_id: "project-123",
      rating: "yes",
      count: 2,
      permission: true,
      recommendation_more_useful: false,
    });
    expect(metadata).not.toHaveProperty("follow_up");
    expect(metadata).not.toHaveProperty("evidence_text");
  });

  it("clips analytics labels and rejects a caller-supplied invalid request id", () => {
    const metadata = sanitizeClientEventMetadata({ source: "x".repeat(200) }, "request-id");
    expect(metadata.source).toHaveLength(120);
    expect(clientRequestId("not-a-uuid")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("preserves a valid version-four request id for retries", () => {
    const requestId = "12d8ed7a-dc62-4a03-98df-27eeb78f62d9";
    expect(clientRequestId(requestId)).toBe(requestId);
  });
});
