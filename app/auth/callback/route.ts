import { NextResponse, type NextRequest } from "next/server";
import { ensureUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const oauthErrorDescription = request.nextUrl.searchParams.get("error_description");
  const requested = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  if (oauthError) {
    const message = oauthErrorDescription || `Google sign-in failed: ${oauthError}`;
    if (process.env.NODE_ENV !== "production") console.error("[auth:callback:oauth_error]", { oauthError, oauthErrorDescription });
    return NextResponse.redirect(`${getSiteUrl()}/sign-in?error=${encodeURIComponent(message)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !(await ensureUserProfile(user)) && process.env.NODE_ENV !== "production") {
        console.error("[auth:callback] profile repair failed after session exchange", { email: user.email });
      }
      return NextResponse.redirect(`${getSiteUrl()}${next}`);
    }
    if (process.env.NODE_ENV !== "production") console.error("[auth:callback]", error);
  }
  const target = next === "/reset-password" ? "/reset-password" : "/sign-in";
  const message = next === "/reset-password" ? "Reset link expired. Please request a fresh reset email." : "The sign-in link is invalid or expired. If this was Google sign-in, check that Google OAuth is enabled in Supabase and that the redirect URL includes /auth/callback.";
  return NextResponse.redirect(`${getSiteUrl()}${target}?error=${encodeURIComponent(message)}`);
}
