import { Resend } from "resend";
import type { MatchResult } from "@/lib/matching";
import type { DigestItem } from "@/lib/notifications/digest";
import type { FounderDigest, FounderDigestProject } from "@/lib/notifications/founder-digest";
import { categoryLabel } from "@/lib/constants";
import { APP_NAME } from "@/lib/brand";
import { getEmailFromAddress } from "@/lib/email-safety";
import { BUSINESS_TYPE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/founder-os/helpers";
import { cleanGeneratedCopy, cleanHeading } from "@/lib/founder-os/copyQuality";
import { getSafeDisplayProjectTitle } from "@/lib/founder-os/titleQuality";
import { getSiteUrl } from "@/lib/utils";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]!);
}

function resendClient() {
  if (!process.env.RESEND_API_KEY || !getEmailFromAddress()) throw new Error("Resend email is not configured");
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendRawEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const { data, error } = await resendClient().emails.send({
    from: getEmailFromAddress()!,
    to,
    subject: cleanGeneratedCopy(subject),
    html,
  });
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function sendOpportunityEmail({
  to,
  name,
  match,
  type,
}: {
  to: string;
  name: string | null;
  match: MatchResult;
  type: "new_match" | "deadline_reminder";
}) {
  const opportunity = match.opportunity;
  const opportunityTitle = cleanHeading(opportunity.title, 96);
  const subject = type === "new_match" ? `New ${match.score}% ${APP_NAME} founder resource: ${opportunityTitle}` : `${APP_NAME} deadline approaching: ${opportunityTitle}`;
  const heading = type === "new_match" ? "A founder signal fits your project" : "A saved resource closes within 7 days";
  const deadline = opportunity.deadline ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${opportunity.deadline}T12:00:00Z`)) : "Rolling";
  const value = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(opportunity.estimated_value ?? 0));

  return sendRawEmail({
    to,
    subject,
    html: `<!doctype html><html><body style="margin:0;background:#f7f4ea;color:#18201b;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:white;border-radius:24px;overflow:hidden"><tr><td style="background:#18201b;color:white;padding:28px 36px"><p style="margin:0;font-weight:bold;color:#ffd166;letter-spacing:1px">${escapeHtml(APP_NAME.toUpperCase())}</p><h1 style="margin:14px 0 0;font-size:30px;line-height:1.15">${escapeHtml(cleanHeading(heading))}</h1></td></tr><tr><td style="padding:36px"><p style="margin:0 0 8px;color:#6d5dfc;font-size:13px;text-transform:uppercase;letter-spacing:1px">${escapeHtml(categoryLabel(opportunity.category))} &middot; ${escapeHtml(value)} estimated value</p><h2 style="margin:0 0 12px;font-size:26px;line-height:1.15">${escapeHtml(opportunityTitle)}</h2><p style="margin:0 0 24px;color:#5f6862;line-height:1.6">Hi ${escapeHtml(name?.split(" ")[0] ?? "there")}, this resource scored <strong>${match.score}%</strong> against your founder profile and saved projects.</p><div style="background:#f7f4ea;border-radius:16px;padding:20px"><p style="margin:0 0 8px"><strong>Deadline:</strong> ${escapeHtml(deadline)}</p><p style="margin:0"><strong>Why it fits:</strong> ${escapeHtml(cleanGeneratedCopy(match.matchedRules.join(", ") || "Open eligibility"))}</p></div><p style="margin:28px 0 0"><a href="${escapeHtml(`${getSiteUrl()}/opportunities/${opportunity.id}/go`)}" style="display:inline-block;background:#6d5dfc;color:white;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:999px">Open founder resource -&gt;</a></p></td></tr></table><p style="max-width:600px;margin:18px auto 0;text-align:center;color:#737b75;font-size:12px">You receive these because email alerts are enabled. Change this in your ${escapeHtml(APP_NAME)} settings.</p></td></tr></table></body></html>`,
  });
}

export function renderOpportunityDigestEmail({ name, items }: { name: string | null; items: DigestItem[] }) {
  const firstName = name?.split(" ")[0] ?? "there";
  const newCount = items.filter((item) => item.types.includes("new_match")).length;
  const deadlineCount = items.filter((item) => item.types.includes("deadline_reminder")).length;
  const subjectParts = [
    newCount ? `${newCount} new match${newCount === 1 ? "" : "es"}` : null,
    deadlineCount ? `${deadlineCount} deadline reminder${deadlineCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  const subject = cleanGeneratedCopy(`${APP_NAME} digest: ${subjectParts.join(" + ") || "new founder fuel"}`);

  const rows = items.map(({ match, types }) => {
    const opportunity = match.opportunity;
    const title = cleanHeading(opportunity.title, 96);
    const description = cleanGeneratedCopy(opportunity.description.slice(0, 220));
    const deadline = opportunity.deadline ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${opportunity.deadline}T12:00:00Z`)) : "Rolling";
    const value = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(opportunity.estimated_value ?? 0));
    const labels = [
      types.includes("new_match") ? "New match" : null,
      types.includes("deadline_reminder") ? "Deadline soon" : null,
    ].filter(Boolean).join(" + ");

    return `<tr><td style="padding:18px 0;border-top:1px solid #eee7d6"><p style="margin:0 0 6px;color:#6d5dfc;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(labels)} &middot; ${escapeHtml(categoryLabel(opportunity.category))} &middot; ${match.score}% fit</p><h2 style="margin:0 0 8px;font-size:20px;line-height:1.2">${escapeHtml(title)}</h2><p style="margin:0 0 10px;color:#5f6862;line-height:1.5">${escapeHtml(description)}${opportunity.description.length > 220 ? "..." : ""}</p><p style="margin:0;color:#18201b;font-size:14px"><strong>Deadline:</strong> ${escapeHtml(deadline)} &nbsp; <strong>Estimated value:</strong> ${escapeHtml(value)}</p><p style="margin:12px 0 0"><a href="${escapeHtml(`${getSiteUrl()}/opportunities/${opportunity.id}/go`)}" style="color:#6d5dfc;font-weight:bold;text-decoration:none">Open founder resource -&gt;</a></p></td></tr>`;
  }).join("");

  return {
    subject,
    html: `<!doctype html><html><body style="margin:0;background:#f7f4ea;color:#18201b;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:auto;background:white;border-radius:24px;overflow:hidden"><tr><td style="background:#18201b;color:white;padding:30px 36px"><p style="margin:0;font-weight:bold;color:#ffd166;letter-spacing:1px">${escapeHtml(APP_NAME.toUpperCase())}</p><h1 style="margin:14px 0 0;font-size:30px;line-height:1.15">Your founder signal digest</h1><p style="margin:12px 0 0;color:#ffffffb3;line-height:1.5">Hi ${escapeHtml(firstName)}, here are the highest-signal founder alerts worth checking today. No email avalanche, promise.</p></td></tr><tr><td style="padding:10px 36px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table><p style="margin:26px 0 0"><a href="${escapeHtml(`${getSiteUrl()}/dashboard`)}" style="display:inline-block;background:#6d5dfc;color:white;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:999px">Open founder dashboard</a></p></td></tr></table><p style="max-width:640px;margin:18px auto 0;text-align:center;color:#737b75;font-size:12px;line-height:1.5">Premium alerts are sent as a capped digest. Change alerts in your ${escapeHtml(APP_NAME)} settings.</p></td></tr></table></body></html>`,
  };
}

export async function sendOpportunityDigestEmail({ to, name, items }: { to: string; name: string | null; items: DigestItem[] }) {
  const rendered = renderOpportunityDigestEmail({ name, items });
  return sendRawEmail({ to, ...rendered });
}

export function renderFounderDigestEmail(digest: FounderDigest) {
  const firstName = digest.user.name?.split(" ")[0] ?? "there";
  const subject = `${APP_NAME} Founder Digest: ${digest.projects.length} project nudge${digest.projects.length === 1 ? "" : "s"} for this week`;
  const projectRows = digest.projects.map(renderFounderProjectRow).join("");
  const actionRows = digest.nextActions.map((action) => `<li style="margin:0 0 10px;color:#5f6862;line-height:1.55">${escapeHtml(action)}</li>`).join("");
  const statusSummary = Object.entries(digest.counts)
    .map(([status, count]) => `${PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS]}: ${count}`)
    .join(" · ");

  return {
    subject,
    html: `<!doctype html><html><body style="margin:0;background:#f7f4ea;color:#18201b;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;margin:auto;background:white;border-radius:24px;overflow:hidden"><tr><td style="background:#18201b;color:white;padding:30px 36px"><p style="margin:0;font-weight:bold;color:#ffd166;letter-spacing:1px">${escapeHtml(APP_NAME.toUpperCase())}</p><h1 style="margin:14px 0 0;font-size:30px;line-height:1.15">Your weekly founder digest</h1><p style="margin:12px 0 0;color:#ffffffb3;line-height:1.5">Hi ${escapeHtml(firstName)}, here are the projects most worth moving forward this week. One digest, no avalanche.</p></td></tr><tr><td style="padding:26px 36px 34px"><div style="background:#f7f4ea;border-radius:18px;padding:18px 20px;margin-bottom:10px"><p style="margin:0;color:#18201b;font-weight:bold">Workspace snapshot</p><p style="margin:8px 0 0;color:#5f6862;line-height:1.5">${escapeHtml(statusSummary)}${digest.bestScore === null ? "" : ` · Best score: ${digest.bestScore}`}</p></div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${projectRows}</table><div style="background:#f1f8dc;border-radius:18px;padding:20px;margin-top:22px"><p style="margin:0 0 12px;color:#315b43;font-weight:bold">Next best moves</p><ul style="margin:0;padding-left:20px">${actionRows}</ul></div><p style="margin:26px 0 0"><a href="${escapeHtml(`${getSiteUrl()}/projects`)}" style="display:inline-block;background:#6d5dfc;color:white;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:999px">Open founder workspace</a></p></td></tr></table><p style="max-width:660px;margin:18px auto 0;text-align:center;color:#737b75;font-size:12px;line-height:1.5">You receive this because email alerts are enabled. Change alerts in your ${escapeHtml(APP_NAME)} settings.</p></td></tr></table></body></html>`,
  };
}

function renderFounderProjectRow(project: FounderDigestProject) {
  const status = PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS];
  const businessType = BUSINESS_TYPE_LABELS[project.business_type as keyof typeof BUSINESS_TYPE_LABELS];
  const reason = founderReasonLabel(project.reason);
  const summary = project.report?.summary.oneSentenceIdea ?? `A ${businessType} project for ${project.target_customer}.`;
  const displayTitle = getSafeDisplayProjectTitle(project);
  return `<tr><td style="padding:20px 0;border-top:1px solid #eee7d6"><p style="margin:0 0 6px;color:#6d5dfc;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(reason)} &middot; ${escapeHtml(status)} &middot; ${escapeHtml(businessType)} &middot; ${project.score}/100</p><h2 style="margin:0 0 8px;font-size:21px;line-height:1.2">${escapeHtml(displayTitle)}</h2><p style="margin:0 0 12px;color:#5f6862;line-height:1.55">${escapeHtml(summary.slice(0, 260))}${summary.length > 260 ? "..." : ""}</p><p style="margin:0"><a href="${escapeHtml(`${getSiteUrl()}/projects/${project.id}`)}" style="color:#6d5dfc;font-weight:bold;text-decoration:none">Open project -&gt;</a></p></td></tr>`;
}

function founderReasonLabel(reason: FounderDigestProject["reason"]) {
  const map = {
    stuck_idea: "Needs validation",
    high_score: "High-score idea",
    building: "Build sprint",
    launched: "Launched project",
    recent: "Recent project",
  };
  return map[reason];
}
