import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { trackUserAction } from "@/lib/gamification/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/utils";

const uuidSchema = z.string().uuid();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, requireProfile()]);
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return NextResponse.redirect(new URL("/dashboard?message=Invalid%20opportunity%20id", getSiteUrl()));
  const admin = createAdminClient();
  const { data: opportunity } = await admin.from("opportunities").select("url").eq("id", parsedId.data).single();
  if (!opportunity?.url || !isHttpUrl(opportunity.url)) return NextResponse.redirect(new URL("/dashboard?message=Opportunity%20not%20found", getSiteUrl()));

  try {
    await trackUserAction({
      userId: profile.id,
      action: "opportunity_viewed",
      opportunityId: parsedId.data,
      idempotencyKey: `opportunity_viewed:${parsedId.data}`,
    });
  } catch {
    // Do not block the user from visiting the official opportunity source if gamification is temporarily unavailable.
  }

  return NextResponse.redirect(opportunity.url);
}

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
