"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { joinChallenge } from "@/lib/gamification/server";
import { checkRateLimit } from "@/lib/rate-limit";

const uuidSchema = z.string().uuid();

export async function joinChallengeAction(challengeId: string) {
  const profile = await requireProfile();
  if (!(await checkRateLimit({ key: `challenge_join:${profile.id}`, limit: 30, windowSeconds: 60 * 60 }))) redirect("/dashboard?message=Slow%20down%20a%20little%20and%20try%20again%20soon.");
  const parsedId = uuidSchema.safeParse(challengeId);
  if (!parsedId.success) redirect("/dashboard?message=Invalid%20challenge%20id");
  try {
    await joinChallenge(profile.id, parsedId.data);
  } catch (error) {
    redirect(`/dashboard?message=${encodeURIComponent(error instanceof Error ? error.message : "Could not join challenge yet.")}`);
  }
  revalidatePath("/dashboard");
  redirect("/dashboard?message=Challenge%20joined.%20Let%27s%20go!");
}
