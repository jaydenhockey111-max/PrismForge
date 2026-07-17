import type { Json } from "@/lib/database.types";

const PRIVATE_METADATA_KEYS = new Set([
  "follow_up",
  "decision_summary",
  "evidence_text",
  "project_idea",
  "raw_prompt",
  "ai_output",
]);

export function sanitizeClientEventMetadata(
  metadata: Record<string, Json | undefined>,
  requestId: string,
) {
  const safe: Record<string, Json> = { request_id: requestId };

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || PRIVATE_METADATA_KEYS.has(key)) continue;
    if (key === "request_id") continue;
    if (typeof value === "string") safe[key] = value.slice(0, 120);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) safe[key] = value;
  }

  return safe;
}

export function clientRequestId(value: Json | undefined) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : crypto.randomUUID();
}
