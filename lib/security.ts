import type { NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/utils";

export function isTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const site = new URL(getSiteUrl());
    const requestOrigin = new URL(origin);
    return requestOrigin.protocol === site.protocol && requestOrigin.host === site.host;
  } catch {
    return false;
  }
}

export function securityHeaders() {
  const useHttps = getSiteUrl().startsWith("https://");
  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.resend.com",
    "frame-src https://checkout.stripe.com https://billing.stripe.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  ];
  if (useHttps) policy.push("upgrade-insecure-requests");
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": policy.join("; "),
  };
}
