import "server-only";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

type AuditInput = {
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, Json | undefined>;
};

function cleanMetadata(metadata?: Record<string, Json | undefined>) {
  if (!metadata) return {};
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

export async function logAuditEvent(input: AuditInput) {
  try {
    const admin = createAdminClient() as any;
    await admin.from("admin_audit_logs").insert({
      actor_id: input.actorId ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: cleanMetadata(input.metadata),
    });
  } catch {
    // Audit logging must never break the user-facing action.
    // The migration may not exist yet in local/dev environments.
  }
}

export async function logEmailFailure(input: {
  userId?: string | null;
  email: string;
  emailType: string;
  error: string;
  metadata?: Record<string, Json | undefined>;
}) {
  try {
    const admin = createAdminClient() as any;
    await admin.from("email_delivery_logs").insert({
      user_id: input.userId ?? null,
      recipient: input.email,
      email_type: input.emailType,
      status: "failed",
      error_message: input.error,
      metadata: cleanMetadata(input.metadata),
    });
  } catch {
    // Best-effort monitoring hook.
  }
}

export async function logEmailSuccess(input: {
  userId?: string | null;
  email: string;
  emailType: string;
  providerId?: string | null;
  metadata?: Record<string, Json | undefined>;
}) {
  try {
    const admin = createAdminClient() as any;
    await admin.from("email_delivery_logs").insert({
      user_id: input.userId ?? null,
      recipient: input.email,
      email_type: input.emailType,
      status: "sent",
      provider_id: input.providerId ?? null,
      metadata: cleanMetadata(input.metadata),
    });
  } catch {
    // Best-effort monitoring hook.
  }
}
