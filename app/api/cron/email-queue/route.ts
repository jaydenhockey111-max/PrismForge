import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processEmailQueue } from "@/lib/email-queue";
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
  try {
    const defaultLimit = Number(process.env.EMAIL_QUEUE_BATCH_SIZE ?? 50);
    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? defaultLimit)));
    const result = await processEmailQueue(createAdminClient(), limit);
    return NextResponse.json({ ok: result.failed === 0, ...result }, { status: result.failed ? 207 : 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Email queue failed" }, { status: 500 });
  }
}
