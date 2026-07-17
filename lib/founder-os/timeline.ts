import { differenceInCalendarDays, isThisWeek } from "date-fns";
import type { FounderTimelineCategory, FounderTimelineResult } from "@/lib/database.types";

export const TIMELINE_CATEGORIES: Array<{ value: "all" | FounderTimelineCategory; label: string }> = [
  { value: "all", label: "All" }, { value: "projects", label: "Projects" }, { value: "validation", label: "Validation" },
  { value: "revenue", label: "Revenue" }, { value: "launch", label: "Launch" }, { value: "learning", label: "Learning" },
  { value: "decisions", label: "Decisions" }, { value: "milestones", label: "Milestones" },
];

export type TimelineGroup = "Today" | "Yesterday" | "This Week" | "Earlier";

export function parseTimelineCategory(value?: string): FounderTimelineCategory | null {
  return TIMELINE_CATEGORIES.some((item) => item.value === value && item.value !== "all") ? value as FounderTimelineCategory : null;
}

export function cleanTimelineQuery(value?: string) {
  return (value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 120);
}

export function groupTimelineEvents(events: FounderTimelineResult[], referenceNow: string) {
  const now = new Date(referenceNow);
  const groups = new Map<TimelineGroup, FounderTimelineResult[]>();
  for (const event of events) {
    const date = new Date(event.created_at);
    const days = differenceInCalendarDays(now, date);
    const label: TimelineGroup = days <= 0 ? "Today" : days === 1 ? "Yesterday" : isThisWeek(date, { weekStartsOn: 1 }) ? "This Week" : "Earlier";
    groups.set(label, [...(groups.get(label) ?? []), event]);
  }
  return (["Today", "Yesterday", "This Week", "Earlier"] as TimelineGroup[]).flatMap((label) => groups.has(label) ? [{ label, events: groups.get(label)! }] : []);
}

export function timelineCursor(event?: FounderTimelineResult) {
  return event ? `${event.created_at}|${event.id}` : null;
}

export function parseTimelineCursor(value?: string) {
  if (!value) return { createdAt: null, id: null };
  const split = value.lastIndexOf("|");
  if (split < 1) return { createdAt: null, id: null };
  const createdAt = value.slice(0, split); const id = value.slice(split + 1);
  if (Number.isNaN(new Date(createdAt).getTime()) || !/^[0-9a-f-]{36}$/i.test(id)) return { createdAt: null, id: null };
  return { createdAt, id };
}

