"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { APP_NAME } from "@/lib/brand";
import { ensureUserProfile } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/utils";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

function messagePath(path: string, key: "error" | "message", value: string) {
  return `${path}?${key}=${encodeURIComponent(value)}`;
}

export async function signUp(formData: FormData) {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const name = z.string().trim().min(2).max(100).safeParse(formData.get("name"));
  if (!parsed.success || !name.success) {
    redirect(messagePath("/sign-up", "error", parsed.error?.issues[0]?.message ?? "Please enter your name."));
  }
  if (!(await checkRateLimit({ key: `auth_signup:${parsed.data.email.toLowerCase()}`, limit: 5, windowSeconds: 15 * 60 }))) {
    redirect(messagePath("/sign-up", "error", "Too many sign-up attempts. Please try again later."));
  }
  const requested = String(formData.get("next") ?? "/dashboard");
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      data: { name: name.data },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    logAuthError("signup", error);
    redirect(messagePath("/sign-up", "error", authErrorMessage(error, "sign-up")));
  }
  if (data.user && !(await ensureUserProfile(data.user))) logAuthDiagnostic("signup_profile_repair_failed", { email: data.user.email });
  if (data.session) redirect(next);
  redirect(messagePath("/sign-in", "message", "Check your email to confirm your account, then sign in."));
}

export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect(messagePath("/sign-in", "error", parsed.error.issues[0].message));
  if (!(await checkRateLimit({ key: `auth_signin:${parsed.data.email.toLowerCase()}`, limit: 10, windowSeconds: 15 * 60 }))) {
    redirect(messagePath("/sign-in", "error", "Too many sign-in attempts. Please try again later."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    logAuthError("signin", error);
    redirect(messagePath("/sign-in", "error", authErrorMessage(error, "sign-in")));
  }
  if (data.user && !(await ensureUserProfile(data.user))) logAuthDiagnostic("signin_profile_repair_failed", { email: data.user.email });

  const requested = String(formData.get("next") ?? "/dashboard");
  redirect(requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard");
}

export async function signInWithGoogle(formData: FormData) {
  const requested = String(formData.get("next") ?? "/dashboard");
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
  if (error || !data.url) {
    if (error) logAuthError("google_oauth", error);
    redirect(messagePath("/sign-in", "error", `Could not start Google sign-in for ${APP_NAME}. Please try email/password.`));
  }
  redirect(data.url);
}

export async function requestPasswordReset(formData: FormData) {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) redirect(messagePath("/forgot-password", "error", "Enter a valid email address."));
  if (!(await checkRateLimit({ key: `auth_reset:${email.data.toLowerCase()}`, limit: 5, windowSeconds: 60 * 60 }))) {
    redirect(messagePath("/forgot-password", "message", "If an account exists, a reset link is on its way."));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error) {
    logAuthError("password_reset", error);
    redirect(messagePath("/forgot-password", "error", "Could not send reset email. Check the email address and Supabase redirect settings."));
  }
  redirect(messagePath("/forgot-password", "message", "If an account exists, a reset link is on its way."));
}

export async function updatePassword(formData: FormData) {
  const password = z.string().min(8, "Password must be at least 8 characters.").safeParse(formData.get("password"));
  if (!password.success) redirect(messagePath("/reset-password", "error", password.error.issues[0].message));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    logAuthError("update_password", error);
    redirect(messagePath("/reset-password", "error", "Reset link expired or could not update password. Please request a fresh reset link."));
  }
  redirect(messagePath("/sign-in", "message", "Password updated. You can sign in now."));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function logAuthError(context: string, error: { message?: string; status?: number; code?: string }) {
  if (process.env.NODE_ENV === "production") return;
  console.error(`[auth:${context}]`, { message: error.message, status: error.status, code: error.code });
}

function logAuthDiagnostic(context: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.error(`[auth:${context}]`, data);
}

function authErrorMessage(error: { message?: string }, mode: "sign-up" | "sign-in") {
  const message = error.message?.toLowerCase() ?? "";
  if (message.includes("already") || message.includes("registered") || message.includes("exists")) return "Account already exists. Try signing in.";
  if (message.includes("confirm") || message.includes("verified")) return "Email not confirmed. Please check your inbox and verification link.";
  if (message.includes("invalid login") || message.includes("invalid credentials")) return "Invalid email or password.";
  if (mode === "sign-in") return "Invalid email or password.";
  return "Could not create that account. Try signing in or use a different email.";
}
