import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logEmailFailure, logEmailSuccess } from "@/lib/audit";
import { enqueueFounderDigest, enqueueOpportunityDigest } from "@/lib/email-queue";
import { sendOpportunityDigestEmail } from "@/lib/email";
import { getEmailDeliverySafety } from "@/lib/email-safety";
import {
  buildDigestForProfile,
  getAlertProfiles,
  getNotificationCandidates,
  markDigestSent,
  NOTIFICATION_LIMITS,
} from "@/lib/notifications/digest";
import {
  buildFounderDigestForProfile,
  FOUNDER_DIGEST_LIMITS,
  getFounderDigestProfiles,
} from "@/lib/notifications/founder-digest";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const actual = request.headers.get("authorization") ?? "";
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return !!process.env.CRON_SECRET && a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const failures: string[] = [];
  let sent = 0;
  let queued = 0;
  let founderQueued = 0;
  let founderDuplicates = 0;
  let founderSkipped = 0;
  let founderRateLimited = 0;
  let duplicates = 0;
  let skipped = 0;
  let rateLimited = 0;

  try {
    const now = new Date();
    const [profiles, candidates, founderProfiles] = await Promise.all([
      getAlertProfiles(admin),
      getNotificationCandidates(admin, now),
      getFounderDigestProfiles(admin),
    ]);

    for (const profile of profiles) {
      const digest = await buildDigestForProfile(admin, profile, candidates, now);
      if (!digest) {
        skipped++;
        continue;
      }

      try {
        const result = await enqueueOpportunityDigest(admin, digest);
        if (result.queued) queued++;
        else if (result.duplicate) duplicates++;
        else if ("skipped" in result && result.skipped) skipped++;
        else if ("rateLimited" in result && result.rateLimited) rateLimited++;
      } catch (error) {
        if (isMissingQueueTable(error)) {
          const deliverySafety = getEmailDeliverySafety(profile.email);
          if (!deliverySafety.allowed) {
            skipped++;
            continue;
          }
          const providerId = await sendOpportunityDigestEmail({
            to: profile.email,
            name: profile.name,
            items: digest.items,
          });
          await markDigestSent(admin, digest);
          await logEmailSuccess({
            userId: profile.id,
            email: profile.email,
            emailType: "opportunity_digest",
            providerId,
            metadata: { items: digest.items.length, fallback: true },
          });
          sent++;
          continue;
        }
        const message = error instanceof Error ? error.message : "Unknown email error";
        failures.push(`${profile.id}: ${message}`);
        await logEmailFailure({
          userId: profile.id,
          email: profile.email,
          emailType: "opportunity_digest",
          error: message,
          metadata: { candidate_count: candidates.length },
        });
      }
    }

    for (const profile of founderProfiles) {
      const digest = await buildFounderDigestForProfile(admin, profile, now);
      if (!digest) {
        founderSkipped++;
        continue;
      }

      try {
        const result = await enqueueFounderDigest(admin, digest);
        if (result.queued) founderQueued++;
        else if (result.duplicate) founderDuplicates++;
        else if ("skipped" in result && result.skipped) founderSkipped++;
        else if ("rateLimited" in result && result.rateLimited) founderRateLimited++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown founder digest error";
        failures.push(`${profile.id}: ${message}`);
        await logEmailFailure({
          userId: profile.id,
          email: profile.email,
          emailType: "founder_weekly_digest",
          error: message,
          metadata: { week_key: digest.weekKey, project_count: digest.projects.length },
        });
      }
    }

    return NextResponse.json({
      ok: failures.length === 0,
      mode: "digest",
      sent,
      queued,
      duplicates,
      skipped,
      rateLimited,
      founderQueued,
      founderDuplicates,
      founderSkipped,
      founderRateLimited,
      candidates: candidates.length,
      profilesChecked: profiles.length,
      founderProfilesChecked: founderProfiles.length,
      limits: NOTIFICATION_LIMITS,
      founderLimits: FOUNDER_DIGEST_LIMITS,
      failures: failures.slice(0, 20),
    }, { status: failures.length ? 207 : 200 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Notification digest failed",
    }, { status: 500 });
  }
}

function isMissingQueueTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return value.code === "42P01" || value.code === "PGRST205" || value.message?.includes("email_queue") === true;
}
