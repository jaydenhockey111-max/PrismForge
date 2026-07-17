"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { requireProfile, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const deleteSchema = z.object({
  confirmation: z.string().trim(),
});

export async function deleteAccount(formData: FormData) {
  const [user, profile] = await Promise.all([requireUser(), requireProfile()]);
  const parsed = deleteSchema.safeParse({ confirmation: formData.get("confirmation") });
  if (!parsed.success || parsed.data.confirmation !== "DELETE") {
    redirect("/account?error=Type%20DELETE%20to%20confirm%20account%20deletion.");
  }

  if (profile.plan === "premium" && profile.stripe_customer_id) {
    redirect("/account?error=Cancel%20your%20paid%20Stripe%20subscription%20from%20Plan%20%26%20billing%20before%20deleting%20your%20account.");
  }

  const admin = createAdminClient() as any;
  try {
    await admin.from("account_deletion_requests").insert({ user_id: user.id, status: "requested", metadata: { source: "self_serve" } });
  } catch {
    // Optional launch-hardening table may not exist yet.
  }

  await logAuditEvent({ actorId: user.id, action: "account.deleted", targetType: "profile", targetId: user.id });
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) redirect(`/account?error=${encodeURIComponent("Could not delete account yet. Please contact support.")}`);
  redirect("/?message=Account%20deleted");
}
