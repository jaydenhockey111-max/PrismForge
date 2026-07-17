"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { INCOME_RANGES, INTERESTS, STUDENT_STATUSES, US_STATES } from "@/lib/constants";
import { updateProfileCompletion } from "@/lib/gamification/server";
import { detectPlaceholderAnswer } from "@/lib/input-quality/detectPlaceholderAnswer";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100),
  age: z.coerce.number().int().min(13).max(120),
  state: z.enum(US_STATES.map(([value]) => value) as [string, ...string[]]),
  income_range: z.enum(INCOME_RANGES.map(([value]) => value) as [string, ...string[]]),
  student_status: z.enum(STUDENT_STATUSES.map(([value]) => value) as [string, ...string[]]),
  occupation: z.string().trim().min(2).max(120),
  goals: z.string().trim().max(1000).optional(),
  resume_link: z.string().trim().max(500).optional().refine((value) => !value || z.string().url().safeParse(value).success, "Resume link must be a valid URL."),
  education_level: z.string().trim().max(120).optional(),
  interests: z.array(z.enum(INTERESTS as [string, ...string[]])).min(1, "Choose at least one interest."),
  alerts_enabled: z.boolean(),
});

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const returnTo = formData.get("return_to") === "settings" ? "settings" : "profile";
  const errorPath = returnTo === "settings" ? "/settings" : "/profile";
  const result = schema.safeParse({
    name: formData.get("name"), age: formData.get("age"), state: formData.get("state"),
    income_range: formData.get("income_range"), student_status: formData.get("student_status"),
    occupation: formData.get("occupation"), goals: formData.get("goals"), resume_link: formData.get("resume_link"),
    education_level: formData.get("education_level"), interests: formData.getAll("interests"),
    alerts_enabled: formData.get("alerts_enabled") === "on",
  });
  if (!result.success) redirect(`${errorPath}?error=${encodeURIComponent(result.error.issues[0].message)}`);
  if (detectPlaceholderAnswer(result.data.occupation, "profile").isPlaceholder) {
    redirect(`${errorPath}?error=${encodeURIComponent("Totally fine if you are unsure — use a real broad role like student, founder, designer, builder, or researcher.")}`);
  }
  const supabase = await createClient();
  const goals = detectPlaceholderAnswer(result.data.goals, "profile").isPlaceholder ? null : result.data.goals || null;
  const educationLevel = detectPlaceholderAnswer(result.data.education_level, "profile").isPlaceholder ? null : result.data.education_level || null;
  const payload = {
    ...result.data,
    goals,
    resume_link: result.data.resume_link || null,
    education_level: educationLevel,
    onboarding_completed: true,
  };
  const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
  if (error) redirect(`${errorPath}?error=${encodeURIComponent(error.message)}`);
  try { await updateProfileCompletion(user.id); } catch { /* The profile should still save if gamification setup is pending. */ }
  revalidatePath("/", "layout");
  if (returnTo === "settings") redirect("/settings?message=Founder%20profile%20saved.");
  redirect("/dashboard?message=Founder%20profile%20saved.%20Your%20signal%20is%20sharper!");
}
