import "server-only";
import { ADMIN_EMAILS, normalizeAuthEmail } from "@/lib/admin";

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "production"]);

export function getEmailFromAddress() {
  return process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM || null;
}

export function getEmailDeliverySafety(recipient: string) {
  const normalized = normalizeAuthEmail(recipient);
  const from = getEmailFromAddress();
  const sender = from?.toLowerCase() ?? "";
  const ownerEmail = ADMIN_EMAILS[0];
  const isOwner = ADMIN_EMAILS.includes(normalized as (typeof ADMIN_EMAILS)[number]);
  const explicitProductionMode = TRUE_VALUES.has((process.env.EMAIL_DELIVERY_MODE ?? "").toLowerCase());
  const verifiedDomain = TRUE_VALUES.has((process.env.RESEND_DOMAIN_VERIFIED ?? process.env.EMAIL_DOMAIN_VERIFIED ?? "").toLowerCase());
  const allowNonOwner = TRUE_VALUES.has((process.env.EMAIL_ALLOW_NON_OWNER ?? "").toLowerCase());
  const looksLikeResendSandbox = !sender || sender.includes("onboarding@resend.dev") || sender.endsWith("@resend.dev>");

  if (isOwner) return { allowed: true, reason: "owner-address" };
  if (allowNonOwner || explicitProductionMode || verifiedDomain) return { allowed: true, reason: "production-email-enabled" };

  return {
    allowed: false,
    reason: `Email delivery is in safe beta mode. Configure a verified Resend domain or EMAIL_DELIVERY_MODE=production before emailing non-owner users. Owner test address: ${ownerEmail}. Current sender: ${from ?? "not configured"}.${looksLikeResendSandbox ? " Sender appears to be the Resend sandbox." : ""}`,
  };
}
