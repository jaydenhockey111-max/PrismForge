import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { canAccessAdmin, isAdminEmail, normalizeAuthEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (data) {
    const expectedRole = isAdminEmail(data.email) ? "admin" : "user";
    if (data.role !== expectedRole || normalizeAuthEmail(data.email) !== normalizeAuthEmail(user.email)) {
      return ensureUserProfile(user);
    }
    return data;
  }
  if (error && process.env.NODE_ENV !== "production") console.error("[auth] current profile lookup failed; attempting repair", { message: error.message, code: error.code });
  return ensureUserProfile(user);
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");
  return profile;
}

export async function ensureUserProfile(user: User) {
  const email = normalizeAuthEmail(user.email);
  if (!email) return null;

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const expectedRole = isAdminEmail(email) ? "admin" : "user";
  if (existing && normalizeAuthEmail(existing.email) === email && existing.role === expectedRole) return existing;
  if (existingError && process.env.NODE_ENV !== "production") console.error("[auth] profile lookup failed", existingError);

  const name = readUserName(user);
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .upsert({
        id: user.id,
        email,
        name: existing?.name ?? name,
        role: expectedRole,
      }, { onConflict: "id" })
      .select("*")
      .single();
    if (error) {
      if (process.env.NODE_ENV !== "production") console.error("[auth] profile repair failed", error);
      return null;
    }
    return data;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[auth] profile repair unavailable", error);
    return null;
  }
}

export async function requireAdmin() {
  const profile = await requireProfile();
  if (!canAccessAdmin(profile)) {
    if (process.env.NODE_ENV !== "production") console.error("[auth] admin access blocked", { email: profile.email, role: profile.role });
    redirect("/dashboard");
  }
  return profile;
}

function readUserName(user: User) {
  const metadata = user.user_metadata ?? {};
  const name = metadata.name ?? metadata.full_name ?? metadata.display_name;
  return typeof name === "string" && name.trim().length > 0 ? name.trim().slice(0, 100) : null;
}
