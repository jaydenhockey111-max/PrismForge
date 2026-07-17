import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEmailFailure, logEmailSuccess } from "@/lib/audit";
import type { Database, Json } from "@/lib/database.types";
import { renderFounderDigestEmail, renderOpportunityDigestEmail, sendRawEmail } from "@/lib/email";
import { getEmailDeliverySafety } from "@/lib/email-safety";
import type { NotificationDigest } from "@/lib/notifications/digest";
import type { FounderDigest } from "@/lib/notifications/founder-digest";

type AdminClient = SupabaseClient<Database>;

type QueueRow = {
  id: string;
  user_id: string | null;
  recipient: string;
  subject: string;
  html: string;
  email_type: string;
  idempotency_key: string;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  metadata: Json;
};

export function digestIdempotencyKey(digest: NotificationDigest) {
  const parts = digest.items
    .flatMap((item) => item.types.map((type) => `${item.match.opportunity.id}:${type}`))
    .sort()
    .join("|");
  return `opportunity_digest:${digest.user.id}:${parts}`;
}

export async function enqueueOpportunityDigest(admin: AdminClient, digest: NotificationDigest) {
  if (!(await canQueueUserEmailToday(admin, digest.user.id))) return { queued: false, duplicate: false, rateLimited: true };
  const deliverySafety = getEmailDeliverySafety(digest.user.email);
  if (!deliverySafety.allowed) return { queued: false, duplicate: false, skipped: true, reason: deliverySafety.reason };
  const rendered = renderOpportunityDigestEmail({ name: digest.user.name, items: digest.items });
  const logRows = digest.items.flatMap((item) =>
    item.types.map((type) => ({
      user_id: digest.user.id,
      opportunity_id: item.match.opportunity.id,
      notification_type: type,
    })),
  );
  const queueAdmin = admin as any;
  const { error } = await queueAdmin.from("email_queue").insert({
    user_id: digest.user.id,
    recipient: digest.user.email,
    subject: rendered.subject,
    html: rendered.html,
    email_type: "opportunity_digest",
    idempotency_key: digestIdempotencyKey(digest),
    metadata: { notification_logs: logRows, item_count: digest.items.length },
  });
  if (error) {
    if (error.code === "23505") return { queued: false, duplicate: true };
    throw error;
  }
  return { queued: true, duplicate: false };
}

export function founderDigestIdempotencyKey(digest: FounderDigest) {
  return `founder_digest:${digest.user.id}:${digest.weekKey}`;
}

export async function enqueueFounderDigest(admin: AdminClient, digest: FounderDigest) {
  if (!(await canQueueUserEmailToday(admin, digest.user.id))) return { queued: false, duplicate: false, rateLimited: true };
  const deliverySafety = getEmailDeliverySafety(digest.user.email);
  if (!deliverySafety.allowed) return { queued: false, duplicate: false, skipped: true, reason: deliverySafety.reason };
  const rendered = renderFounderDigestEmail(digest);
  const queueAdmin = admin as any;
  const { error } = await queueAdmin.from("email_queue").insert({
    user_id: digest.user.id,
    recipient: digest.user.email,
    subject: rendered.subject,
    html: rendered.html,
    email_type: "founder_weekly_digest",
    idempotency_key: founderDigestIdempotencyKey(digest),
    metadata: {
      week_key: digest.weekKey,
      project_ids: digest.projects.map((project) => project.id),
      project_count: digest.projects.length,
      best_score: digest.bestScore,
    },
  });
  if (error) {
    if (error.code === "23505") return { queued: false, duplicate: true };
    throw error;
  }
  return { queued: true, duplicate: false };
}

export async function canQueueUserEmailToday(admin: AdminClient, userId: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const queueAdmin = admin as any;
  const { count, error } = await queueAdmin
    .from("email_queue")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", cutoff)
    .in("status", ["queued", "sending", "sent", "failed"]);
  if (error) {
    const missingQueue = error.code === "42P01" || error.code === "PGRST205" || String(error.message ?? "").includes("email_queue");
    if (missingQueue) return true;
    throw error;
  }
  return (count ?? 0) === 0;
}

export async function processEmailQueue(admin: AdminClient, limit = 50) {
  const queueAdmin = admin as any;
  const now = new Date().toISOString();
  const { data: rows, error } = await queueAdmin
    .from("email_queue")
    .select("*")
    .in("status", ["queued", "failed"])
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of (rows ?? []) as QueueRow[]) {
    const { data: claimed, error: claimError } = await queueAdmin
      .from("email_queue")
      .update({ status: "sending", attempts: row.attempts + 1, last_error: null })
      .eq("id", row.id)
      .in("status", ["queued", "failed"])
      .select("*")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) {
      skipped++;
      continue;
    }

    try {
      const deliverySafety = getEmailDeliverySafety(row.recipient);
      if (!deliverySafety.allowed) {
        await queueAdmin.from("email_queue").update({
          status: "failed",
          attempts: row.attempts + 1,
          last_error: `Skipped: ${deliverySafety.reason}`,
          next_attempt_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
        }).eq("id", row.id);
        skipped++;
        continue;
      }
      const providerId = await sendRawEmail({ to: row.recipient, subject: row.subject, html: row.html });
      await insertNotificationLogs(admin, row.metadata);
      await queueAdmin.from("email_queue").update({
        status: "sent",
        provider_id: providerId,
        sent_at: new Date().toISOString(),
      }).eq("id", row.id);
      await logEmailSuccess({ userId: row.user_id, email: row.recipient, emailType: row.email_type, providerId });
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email error";
      const attempts = row.attempts + 1;
      const retryMinutes = Math.min(60 * 24, Math.pow(2, Math.min(attempts, 8)));
      await queueAdmin.from("email_queue").update({
        status: "failed",
        attempts,
        last_error: message,
        next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
      }).eq("id", row.id);
      await logEmailFailure({ userId: row.user_id, email: row.recipient, emailType: row.email_type, error: message });
      failed++;
    }
  }

  return { sent, failed, skipped, checked: rows?.length ?? 0 };
}

async function insertNotificationLogs(admin: AdminClient, metadata: Json) {
  const rows = typeof metadata === "object" && metadata && !Array.isArray(metadata)
    ? (metadata.notification_logs as unknown)
    : null;
  if (!Array.isArray(rows) || rows.length === 0) return;
  const { error } = await admin.from("notification_logs").insert(rows as Array<{ user_id: string; opportunity_id: string; notification_type: "new_match" | "deadline_reminder" }>);
  if (error && error.code !== "23505") throw error;
}
