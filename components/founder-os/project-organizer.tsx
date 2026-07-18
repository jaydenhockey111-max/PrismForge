"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Clock3, Focus, Search } from "lucide-react";
import { focusProject, resumeProject } from "@/app/(app)/projects/lifecycle-actions";
import { LifecycleBadge, ProjectLifecycleControls } from "@/components/founder-os/project-lifecycle-controls";
import { ProjectStatusBadge } from "@/components/founder-os/project-status-badge";
import type { ProjectLifecycleStatus } from "@/lib/database.types";
import type { BusinessType, ProjectStatus } from "@/lib/founder-os/types";
import { BUSINESS_TYPE_LABELS } from "@/lib/founder-os/helpers";
import { compareLifecycleProjects, matchesLifecycleFilter, type ProjectLibraryFilter, type ProjectLibrarySort } from "@/lib/founder-os/projectLifecycle";

export type OrganizedProject = {
  id: string; title: string; businessType: BusinessType; targetCustomer: string; score: number; status: ProjectStatus;
  lifecycleStatus: ProjectLifecycleStatus; lifecycleVersion: number; isCurrentFocus: boolean; deletedAt: string | null; recoveryExpiresAt: string | null;
  createdAt: string; updatedAt: string; lastMeaningfulActivityAt: string; proofConfidence: number; proofExperiments: number; peopleContacted: number; nextAction: string; hasClosureReflection: boolean;
};

const filters: Array<{ value: ProjectLibraryFilter; label: string }> = [
  { value: "all", label: "All current" }, { value: "active", label: "Active" }, { value: "paused", label: "Paused" }, { value: "completed", label: "Completed" }, { value: "archived", label: "Archived" }, { value: "abandoned", label: "Stopped" }, { value: "deleted", label: "Recovery" },
];
const sorts: Array<{ value: ProjectLibrarySort; label: string }> = [
  { value: "focus", label: "Current focus" }, { value: "recent_activity", label: "Recently active" }, { value: "recently_created", label: "Recently created" }, { value: "stage", label: "Founder stage" }, { value: "name", label: "Project name" },
];

export function ProjectOrganizer({ projects, referenceNow }: { projects: OrganizedProject[]; referenceNow: string }) {
  const searchParams = useSearchParams(); const pathname = usePathname(); const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<ProjectLibraryFilter>(validFilter(searchParams.get("filter")));
  const [sort, setSort] = useState<ProjectLibrarySort>(validSort(searchParams.get("sort")));
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState("");
  const current = projects.find((project) => project.isCurrentFocus && !project.deletedAt && project.lifecycleStatus === "active") ?? null;
  const visible = useMemo(() => projects.filter((project) => matchesLifecycleFilter(toSummary(project), filter)).filter((project) => matchesQuery(project, query)).sort((a,b) => compareLifecycleProjects(toSummary(a),toSummary(b),sort)), [filter, projects, query, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(); if (query.trim()) params.set("q", query.trim()); if (filter !== "all") params.set("filter", filter); if (sort !== "focus") params.set("sort", sort);
      router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filter, pathname, query, router, sort]);
  useEffect(() => { if (query.trim().length < 2) return; const timer=window.setTimeout(()=>logLibraryEvent("project_search_used",{ query_length_bucket: query.trim().length < 6 ? "2-5" : query.trim().length < 16 ? "6-15" : "16+" }),600); return()=>window.clearTimeout(timer); },[query]);

  function resume(project: OrganizedProject) {
    setMessage(""); startTransition(async () => { const result = await resumeProject(project.id, crypto.randomUUID(), project.lifecycleVersion, "project_library"); if (!result.ok) setMessage(result.error ?? "Could not resume this project."); else if (result.href) router.push(result.href); });
  }
  function focus(project: OrganizedProject) {
    setMessage(""); startTransition(async () => { const result = await focusProject(project.id, crypto.randomUUID(), "project_library"); if (!result.ok) setMessage(result.error ?? "Could not change the current focus."); else { setMessage("Current focus updated."); router.refresh(); } });
  }

  return <div className="mt-8">
    {current ? <CurrentFocus project={current} pending={pending} onResume={() => resume(current)} /> : <section className="rounded-[2rem] border border-dashed border-violet/30 bg-violet/5 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.16em] text-violet">No current focus</p><h2 className="mt-2 font-display text-2xl font-semibold text-ink">Choose one active project to prioritize.</h2><p className="mt-2 text-sm leading-6 text-ink/60">Other active projects stay active. Selecting a focus does not change stage or call AI.</p></section>}
    {message && <p role="status" className="mt-4 rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{message}</p>}
    <section className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-4 shadow-card sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_190px_210px]">
        <label className="relative block"><span className="sr-only">Search projects</span><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, audience, or type" className="min-h-12 w-full rounded-2xl border border-ink/10 bg-cream/60 pl-11 pr-4 text-sm font-semibold text-ink outline-none focus:border-violet focus:ring-2 focus:ring-violet/15" /></label>
        <Control label="Show" value={filter} onChange={(value) => { setFilter(value as ProjectLibraryFilter); logLibraryEvent("project_filter_applied", { filter: value }); }} options={filters} />
        <Control label="Sort" value={sort} onChange={(value) => { setSort(value as ProjectLibrarySort); logLibraryEvent("project_sort_changed", { sort: value }); }} options={sorts} />
      </div>
      <div className="mt-5 flex items-center justify-between gap-3"><p className="text-sm font-bold text-ink/55">{visible.length} project{visible.length === 1 ? "" : "s"} in this view</p>{(query || filter !== "all" || sort !== "focus") && <button type="button" onClick={() => { setQuery(""); setFilter("all"); setSort("focus"); }} className="text-sm font-black text-violet hover:text-ink">Clear view</button>}</div>
      {visible.length === 0 ? <div className="mt-5 rounded-[1.5rem] border border-dashed border-ink/15 bg-cream/50 p-6 text-sm leading-6 text-ink/60">No projects match this view. Clear the search or choose another lifecycle filter.</div> : <div className="mt-5 grid gap-3">{visible.map((project) => <ProjectRow key={project.id} project={project} pending={pending} referenceNow={referenceNow} onResume={() => resume(project)} onFocus={() => focus(project)} />)}</div>}
    </section>
  </div>;
}

function CurrentFocus({ project, pending, onResume }: { project: OrganizedProject; pending: boolean; onResume: () => void }) { return <section className="rounded-[2rem] border border-violet/20 bg-gradient-to-br from-violet/10 via-white to-lime/25 p-5 shadow-card sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><LifecycleBadge status={project.lifecycleStatus} currentFocus /><ProjectStatusBadge status={project.status} /></div><h2 className="mt-3 break-words font-display text-3xl font-semibold text-ink">{project.title}</h2><p className="mt-2 text-sm text-ink/60">{project.targetCustomer}</p><p className="mt-4 max-w-3xl rounded-2xl bg-white/85 p-4 text-sm font-semibold leading-6 text-ink/70"><strong className="text-ink">Next:</strong> {project.nextAction}</p></div><button type="button" disabled={pending} onClick={onResume} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet disabled:opacity-50">Resume project <ArrowUpRight className="size-4" /></button></div></section>; }
function ProjectRow({ project, pending, referenceNow, onResume, onFocus }: { project: OrganizedProject; pending: boolean; referenceNow: string; onResume: () => void; onFocus: () => void }) { const active = project.lifecycleStatus === "active" && !project.deletedAt; return <article className="rounded-[1.5rem] border border-ink/10 bg-white p-4 transition hover:border-violet/25 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><Link href={`/projects/${project.id}?section=today`} className="min-w-0 flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"><div className="flex flex-wrap items-center gap-2"><LifecycleBadge status={project.lifecycleStatus} deletedAt={project.deletedAt} currentFocus={project.isCurrentFocus} /><ProjectStatusBadge status={project.status} /><span className="text-xs font-bold text-ink/45">{BUSINESS_TYPE_LABELS[project.businessType]}</span></div><h3 className="mt-3 break-words font-display text-xl font-semibold text-ink">{project.title}</h3><p className="mt-1 line-clamp-1 text-sm text-ink/55">{project.targetCustomer}</p><p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-ink/65">{project.nextAction}</p><p className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink/45"><Clock3 className="size-3.5" />Meaningful activity {formatAgo(project.lastMeaningfulActivityAt, referenceNow)} · {project.proofExperiments} proof test{project.proofExperiments === 1 ? "" : "s"}</p></Link><div className="flex flex-wrap items-center gap-2 lg:justify-end">{active && !project.isCurrentFocus && <button type="button" disabled={pending} onClick={onFocus} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet/20 px-4 text-xs font-black text-violet hover:bg-violet hover:text-white"><Focus className="size-4" />Focus</button>}{(active || project.lifecycleStatus === "paused") && <button type="button" disabled={pending} onClick={onResume} className="min-h-10 rounded-full bg-ink px-4 text-xs font-black text-white hover:bg-violet">{project.lifecycleStatus === "paused" ? "Resume" : "Open Today"}</button>}<ProjectLifecycleControls projectId={project.id} title={project.title} lifecycleStatus={project.lifecycleStatus} lifecycleVersion={project.lifecycleVersion} deletedAt={project.deletedAt} recoveryExpiresAt={project.recoveryExpiresAt} hasClosureReflection={project.hasClosureReflection} compact /></div></div></article>; }
function Control({ label, value, onChange, options }: { label: string; value: string; onChange: (value:string)=>void; options: Array<{value:string;label:string}> }) { return <label className="grid gap-1 text-xs font-black uppercase tracking-[.14em] text-ink/45">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 rounded-2xl border border-ink/10 bg-cream/60 px-4 text-sm font-semibold normal-case tracking-normal text-ink outline-none focus:border-violet">{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function matchesQuery(project: OrganizedProject, query: string) { const normalized=query.trim().toLocaleLowerCase(); if(!normalized)return true; return [project.title,project.targetCustomer,project.businessType,BUSINESS_TYPE_LABELS[project.businessType]].join(" ").toLocaleLowerCase().includes(normalized); }
function toSummary(project: OrganizedProject) { return { id:project.id,lifecycleStatus:project.lifecycleStatus,stage:project.status,isCurrentFocus:project.isCurrentFocus,deletedAt:project.deletedAt,lastMeaningfulActivityAt:project.lastMeaningfulActivityAt,createdAt:project.createdAt,title:project.title }; }
function validFilter(value: string | null): ProjectLibraryFilter { return ["active","paused","completed","archived","abandoned","deleted"].includes(value ?? "") ? value as ProjectLibraryFilter : "all"; }
function validSort(value: string | null): ProjectLibrarySort { return ["recent_activity","recently_created","stage","name"].includes(value ?? "") ? value as ProjectLibrarySort : "focus"; }
function formatAgo(value: string, referenceNow: string) { const time=new Date(value).getTime(); const now=new Date(referenceNow).getTime(); if(!Number.isFinite(time)||!Number.isFinite(now))return "recently"; const minutes=Math.max(1,Math.round((now-time)/60000)); if(minutes<60)return `${minutes}m ago`; const hours=Math.round(minutes/60); if(hours<48)return `${hours}h ago`; return `${Math.round(hours/24)}d ago`; }
function logLibraryEvent(eventName: string, metadata: Record<string,string>) { void fetch("/api/beta-events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventName,metadata})}).catch(()=>undefined); }
