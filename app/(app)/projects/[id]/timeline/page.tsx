import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { notFound } from "next/navigation";
import { FounderTimeline } from "@/components/founder-os/founder-timeline";
import { FormMessage } from "@/components/ui/form";
import { requireProfile } from "@/lib/auth";
import { loadFounderTimeline } from "@/lib/founder-os/timeline.server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Project Timeline" };
export const dynamic = "force-dynamic";

export default async function ProjectTimelinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; category?: string; before?: string }> }) {
  const [profile, route, query, supabase] = await Promise.all([requireProfile(), params, searchParams, createClient()]);
  const { data: project } = await supabase.from("opportunity_projects").select("id,title").eq("id",route.id).eq("user_id",profile.id).maybeSingle();
  if (!project) notFound();
  const timeline = await loadFounderTimeline({ projectId: project.id, query: query.q, category: query.category, before: query.before });
  return <div>
    <FormMessage message={timeline.error ?? undefined} />
    <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm font-black text-ink/55 hover:text-ink"><ArrowLeft className="size-4" />Back to project</Link>
    <div className="mt-7 flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet"><History className="size-4" />Project history</div>
    <h1 className="page-title mt-3 break-words">{project.title}</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60 sm:text-base">Only meaningful decisions, evidence, lifecycle changes, milestones, launches, and lessons for this project.</p>
    <FounderTimeline {...timeline} projectId={project.id} referenceNow={new Date().toISOString()} />
  </div>;
}

