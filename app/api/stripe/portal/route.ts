import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isTrustedOrigin } from "@/lib/security";
import { getStripe } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/utils";

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${getSiteUrl()}/sign-in`, 303);
  if (!(await checkRateLimit({ key: `stripe_portal:${user.id}`, limit: 20, windowSeconds: 60 * 60 }))) {
    return NextResponse.redirect(`${getSiteUrl()}/billing?error=${encodeURIComponent("Too many billing portal attempts. Please try again later.")}`, 303);
  }

  try {
    const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
    if (!profile?.stripe_customer_id) return NextResponse.redirect(`${getSiteUrl()}/billing?error=${encodeURIComponent("No billing account exists yet.")}`, 303);
    const session = await getStripe().billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: `${getSiteUrl()}/billing` });
    await logAuditEvent({ actorId: user.id, action: "billing.portal_opened", targetType: "stripe_customer", targetId: profile.stripe_customer_id });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    await logAuditEvent({ actorId: user.id, action: "billing.portal_failed", targetType: "stripe", metadata: { error: error instanceof Error ? error.message : "Unknown Stripe error" } });
    return NextResponse.redirect(`${getSiteUrl()}/billing?error=${encodeURIComponent("Stripe billing portal is temporarily unavailable.")}`, 303);
  }
}
