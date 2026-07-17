import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import type { OpportunityReport } from "@/lib/founder-os/types";
import { opportunityReportToMarkdown } from "@/lib/founder-os/markdown";
import { getSafeDisplayProjectTitle } from "@/lib/founder-os/titleQuality";
import { createClient } from "@/lib/supabase/server";
import { logBetaEvent } from "@/lib/analytics/betaEvents";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [profile, routeParams] = await Promise.all([requireProfile(), params]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunity_projects")
    .select("title,business_type,target_customer,report_json")
    .eq("id", routeParams.id)
    .eq("user_id", profile.id)
    .single();

  if (!data) notFound();
  const report = data.report_json as unknown as OpportunityReport;
  const displayTitle = getSafeDisplayProjectTitle(data);
  const displayReport = { ...report, summary: { ...report.summary, title: displayTitle } };
  const markdown = opportunityReportToMarkdown(displayReport);
  const slug = displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "prismforge-report";
  await logBetaEvent({ userId: profile.id, projectId: routeParams.id, eventName: "payment_signal_recorded", source: "project_export", metadata: { signal: "project_exported" }, throttleSeconds: 15 * 60 });

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
