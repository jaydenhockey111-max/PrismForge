export const ADMIN_EMAILS = ["jayden.hockey111@gmail.com"] as const;

export function normalizeAuthEmail(email: string | undefined | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function isAdminEmail(email: string | undefined | null) {
  const normalized = normalizeAuthEmail(email);
  return ADMIN_EMAILS.includes(normalized as (typeof ADMIN_EMAILS)[number]);
}

export function canAccessAdmin(identity: { email?: string | null } | null | undefined) {
  return isAdminEmail(identity?.email);
}

export const isAdminUser = canAccessAdmin;
