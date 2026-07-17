import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Missing webhook configuration" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await syncSubscription(event.data.object);
    }
    if (event.type === "invoice.payment_failed") {
      await logAuditEvent({ action: "billing.payment_failed", targetType: "stripe_invoice", targetId: event.data.object.id });
    }
    if (event.type === "checkout.session.completed") {
      await logAuditEvent({ action: "billing.checkout_completed", targetType: "stripe_checkout_session", targetId: event.data.object.id });
    }
  } catch (error) {
    await logAuditEvent({ action: "billing.webhook_failed", targetType: "stripe_event", targetId: event.id, metadata: { type: event.type, error: error instanceof Error ? error.message : "Unknown webhook error" } });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const admin = createAdminClient();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  let userId: string | undefined = subscription.metadata.user_id || undefined;
  if (!userId) {
    const { data: profile } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).single();
    userId = profile?.id;
  }
  if (!userId) throw new Error(`No user found for Stripe customer ${customerId}`);

  const premium = subscription.status === "active" || subscription.status === "trialing";
  const periodEnd = subscription.current_period_end;
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const { error } = await admin.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
  }, { onConflict: "user_id" });
  if (error) throw error;

  const { error: profileError } = await admin.from("profiles").update({ plan: premium ? "premium" : "free" }).eq("id", userId);
  if (profileError) throw profileError;
  await logAuditEvent({
    actorId: userId,
    action: premium ? "billing.subscription_active" : "billing.subscription_inactive",
    targetType: "stripe_subscription",
    targetId: subscription.id,
    metadata: { status: subscription.status, price_id: priceId },
  });
}
