import { describe, expect, it } from "vitest";
import type { FounderTimelineResult } from "@/lib/database.types";
import { cleanTimelineQuery, groupTimelineEvents, parseTimelineCategory, parseTimelineCursor, timelineCursor } from "./timeline";

const event = (id: string, created_at: string) => ({ id, created_at } as FounderTimelineResult);

describe("founder timeline", () => {
  it("accepts only canonical categories and bounds search", () => {
    expect(parseTimelineCategory("validation")).toBe("validation");
    expect(parseTimelineCategory("clicks")).toBeNull();
    expect(cleanTimelineQuery(" a\u0000b ")).toBe("a b");
    expect(cleanTimelineQuery("x".repeat(200))).toHaveLength(120);
  });
  it("groups newest history into human time sections", () => {
    const groups = groupTimelineEvents([event("1", "2026-07-12T12:00:00Z"), event("2", "2026-07-11T12:00:00Z"), event("3", "2026-06-01T12:00:00Z")], "2026-07-12T15:00:00Z");
    expect(groups.map((group) => group.label)).toEqual(["Today", "Yesterday", "Earlier"]);
  });
  it("round trips a keyset cursor and rejects malformed values", () => {
    const row = event("11111111-1111-4111-8111-111111111111", "2026-07-12T12:00:00.000Z");
    expect(parseTimelineCursor(timelineCursor(row) ?? "")).toEqual({ createdAt: row.created_at, id: row.id });
    expect(parseTimelineCursor("bad")).toEqual({ createdAt: null, id: null });
  });
});
