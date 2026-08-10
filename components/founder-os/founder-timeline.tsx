import Link from "next/link";
import { format } from "date-fns";
import { ArrowDown, ArrowRight, CheckCircle2, CircleDollarSign, FlaskConical, FolderKanban, Lightbulb, Milestone, Rocket, Search, ShieldCheck } from "lucide-react";
import type { FounderTimelineCategory, FounderTimelineResult } from "@/lib/database.types";
import { groupTimelineEvents, TIMELINE_CATEGORIES, timelineCursor } from "@/lib/founder-os/timeline";
import { cn } from "@/lib/utils";

export function FounderTimeline({ events, referenceNow, category, query, projectId, nextPage }: { events: FounderTimelineResult[]; referenceNow: string; category: FounderTimelineCategory | null; query: string; projectId?: string; nextPage: boolean }) {
  const pathname = projectId ? `/projects/${projectId}/timeline` : "/timeline";
  const groups = groupTimelineEvents(events, referenceNow);
  const nextCursor = nextPage ? timelineCursor(events.at(-1)) : null;
  return (
    <>
      <form action={pathname} className="mt-6 rounded-[1.75rem] border border-ink/10 bg-white p-4 shadow-card" role="search">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative min-w-0"><span className="sr-only">Search founder timeline</span><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/40" /><input name="q" defaultValue={query} maxLength={120} placeholder="Search projects, decisions, lessons…" className="min-h-12 w-full rounded-2xl border border-ink/15 bg-cream/40 pl-11 pr-4 text-sm font-semibold text-ink outline-none focus:border-violet focus:ring-2 focus:ring-violet/15" /></label>
          <label><span className="sr-only">Filter timeline category</span><select name="category" defaultValue={category ?? "all"} className="min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-sm font-bold text-ink md:w-auto">{TIMELINE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <button className="min-h-12 rounded-full bg-ink px-6 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2">Search</button>
        </div>
      </form>

      {groups.length === 0 ? <TimelineEmpty filtered={Boolean(category || query)} projectId={projectId} /> : (
        <div className="mt-8 space-y-10">
          {groups.map((group) => <section key={group.label} aria-labelledby={`timeline-${group.label.replace(/\s/g,"-").toLowerCase()}`}>
            <div className="mb-4 flex items-center gap-3"><span className="h-px flex-1 bg-ink/10" /><h2 id={`timeline-${group.label.replace(/\s/g,"-").toLowerCase()}`} className="text-xs font-black uppercase tracking-[.18em] text-ink/45">{group.label}</h2><span className="h-px flex-1 bg-ink/10" /></div>
            <ol className="relative space-y-4 before:absolute before:bottom-5 before:left-[1.35rem] before:top-5 before:w-px before:bg-gradient-to-b before:from-violet/50 before:via-moss/30 before:to-transparent sm:before:left-[1.6rem]">
              {group.events.map((event) => <TimelineCard key={event.id} event={event} />)}
            </ol>
          </section>)}
        </div>
      )}
      {nextCursor && <div className="mt-8 flex justify-center"><Link href={`${pathname}?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(category ? { category } : {}), before: nextCursor }).toString()}`} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-ink/15 bg-white px-6 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:border-violet hover:shadow-md">Load earlier history <ArrowDown className="size-4" /></Link></div>}
    </>
  );
}

function TimelineCard({ event }: { event: FounderTimelineResult }) {
  const Icon = categoryIcon(event.category);
  const learningInsightId = event.origin_system === "founder_learning" && event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) && typeof event.metadata.insight_id === "string" ? event.metadata.insight_id : null;
  const hasDetails = Boolean(event.decision_reason || event.previous_assumption || event.new_assumption || event.decision_evidence || event.decision_outcome || event.proof_learnings);
  return <li className="relative pl-12 sm:pl-14">
    <span className={cn("absolute left-0 top-5 z-10 grid size-11 place-items-center rounded-2xl border bg-white shadow-sm sm:size-12", categoryTone(event.category))}><Icon className="size-5" aria-hidden="true" /></span>
    <article className="min-w-0 overflow-hidden rounded-[1.6rem] border border-ink/10 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-violet/25 hover:shadow-lg sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-black uppercase tracking-[.1em] text-ink/55">{event.category}</span>{event.evidence_level !== "none" && <span className="inline-flex items-center gap-1 rounded-full bg-lime/30 px-2.5 py-1 text-[11px] font-black text-moss"><ShieldCheck className="size-3" />{evidenceLabel(event.evidence_level)}</span>}</div><h3 className="mt-3 break-words font-display text-xl font-semibold text-ink">{event.headline}</h3>{event.description && <p className="mt-2 break-words text-sm leading-6 text-ink/60">{event.description}</p>}</div>
        <time dateTime={event.created_at} className="shrink-0 text-xs font-bold text-ink/45">{format(new Date(event.created_at), "MMM d · h:mm a")}</time>
      </div>
      {event.project_title && <p className="mt-3 truncate text-xs font-bold text-violet">{event.project_title}</p>}
      {hasDetails && <details className="mt-4 rounded-2xl border border-ink/10 bg-cream/45 p-4"><summary className="cursor-pointer text-sm font-black text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">View context</summary><DecisionContext event={event} /></details>}
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-black">{event.project_id && <Link href={`/projects/${event.project_id}`} className="inline-flex items-center gap-1 text-violet hover:text-ink">View project <ArrowRight className="size-3.5" /></Link>}{event.proof_experiment_id && event.project_id && <Link href={`/projects/${event.project_id}?section=validate`} className="inline-flex items-center gap-1 text-moss hover:text-ink">View proof <ArrowRight className="size-3.5" /></Link>}{learningInsightId&&<Link href={`/progress#learning-${learningInsightId}`} className="inline-flex items-center gap-1 text-violet hover:text-ink">View learning <ArrowRight className="size-3.5"/></Link>}</div>
    </article>
  </li>;
}

function DecisionContext({ event }: { event: FounderTimelineResult }) {
  return <div className="mt-3 space-y-3 break-words text-sm leading-6 text-ink/65">
    {event.previous_assumption && <Context label="Before" value={event.previous_assumption} />}
    {event.new_assumption && <><div className="pl-2 text-violet">↓</div><Context label="After" value={event.new_assumption} /></>}
    {event.decision_reason && <Context label="Why" value={event.decision_reason} />}
    {event.decision_evidence && <Context label="Evidence" value={event.decision_evidence} />}
    {event.decision_outcome && <Context label="Outcome" value={event.decision_outcome} />}
    {event.proof_learnings && <Context label="Learning" value={event.proof_learnings} />}
  </div>;
}
function Context({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-black uppercase tracking-[.14em] text-ink/40">{label}</p><p className="mt-1">{value}</p></div>; }
function TimelineEmpty({ filtered, projectId }: { filtered: boolean; projectId?: string }) { return <section className="mt-8 rounded-[2rem] border border-dashed border-violet/25 bg-gradient-to-br from-white to-violet/5 p-8 text-center"><CheckCircle2 className="mx-auto size-10 text-violet" /><h2 className="mt-4 font-display text-2xl font-semibold text-ink">{filtered ? "No history matches that search." : "Meaningful progress will appear here."}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink/60">{filtered ? "Try a broader phrase or choose All." : "PrismForge records decisions, real validation, launch milestones, lessons, and project lifecycle changes—not clicks or AI conversations."}</p>{filtered && <Link href={projectId ? `/projects/${projectId}/timeline` : "/timeline"} className="mt-5 inline-flex font-black text-violet">Clear filters</Link>}</section>; }
function evidenceLabel(value: FounderTimelineResult["evidence_level"]) { return value === "system_verified" ? "Verified" : value === "evidence_supported" ? "Evidence" : value === "manual_detailed" ? "Documented" : "Self-reported"; }
function categoryIcon(category: FounderTimelineCategory) { return category === "projects" ? FolderKanban : category === "validation" ? FlaskConical : category === "revenue" ? CircleDollarSign : category === "launch" ? Rocket : category === "learning" ? Lightbulb : category === "decisions" ? CheckCircle2 : Milestone; }
function categoryTone(category: FounderTimelineCategory) { return category === "revenue" ? "border-gold/30 text-amber-700" : category === "validation" ? "border-sky/40 text-blue-700" : category === "launch" ? "border-coral/30 text-coral" : category === "learning" ? "border-lime/50 text-moss" : "border-violet/25 text-violet"; }
