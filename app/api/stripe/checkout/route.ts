import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isTrustedOrigin } from "@/lib/security";
import { getStripe } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/utils";

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${getSiteUrl()}/sign-in`, 303);
  if (!(await checkRateLimit({ key: `stripe_checkout:${user.id}`, limit: 10, windowSeconds: 60 * 60 }))) {
    return NextResponse.redirect(`${getSiteUrl()}/billing?error=${encodeURIComponent("Too many checkout attempts. Please try again later.")}`, 303);
  }

  try {
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (profileError || !profile) return NextResponse.redirect(`${getSiteUrl()}/billing?error=${encodeURIComponent("Profile not found.")}`, 303);
    if (!process.env.STRIPE_PREMIUM_PRICE_ID) return NextResponse.redirect(`${getSiteUrl()}/billing?error=${encodeURIComponent("Stripe price is not configured yet.")}`, 303);

    const stripe = getStripe();
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: profile.email, name: profile.name ?? undefined, metadata: { user_id: user.id } },
        { idempotencyKey: `customer:${user.id}` },
      );
      customerId = customer.id;
      const admin = createAdminClient();
      const { error } = await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
      if (error) return NextResponse.redirect(`${getSiteUrl()}/billing?error=${encodeURIComponent("Could not connect billing profile.")}`, 303);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${getSiteUrl()}/billing?success=1`,
      cancel_url: `${getSiteUrl()}/billing?canceled=1`,
      subscription_data: { metadata: { user_id: user.id } },
    });

    if (!session.url) return NextResponse.redirect(`${getSiteUrl()}/billing?error=${encodeURIComponent("Stripe did not return a checkout URL.")}`, 303);
    await logAuditEvent({ actorId: user.id, action: "billing.checkout_started", targetType: "stripe_customer", targetId: customerId });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    await logAuditEvent({ actorId: user.id, action: "billing.checkout_failed", targetType: "stripe", metadata: { error: error instanceof Error ? error.message : "Unknown Stripe error" } });
    return NextResponse.redirect(`${getSiteUrl()}/billing?error=${encodeURIComponent("Stripe is temporarily unavailable. Please try again in a few minutes.")}`, 303);
  }
}
