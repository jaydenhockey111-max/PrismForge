"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ClipboardCheck, Lightbulb, RefreshCcw, ShieldCheck, Target, X } from "lucide-react";
import type { FounderQuest } from "@/lib/progress/questPolicy";
import { completeFounderQuest } from "@/app/(app)/progress/actions";

type StoredQuestCompletion = {
  questId: string;
  status: "completed" | "skipped" | "replaced";
  detail: string;
  completedAt: string;
  alternativeTitle?: string;
};

type QuestCardProps = {
  quest: FounderQuest;
  variant?: "primary" | "compact";
};

export function DailyQuestCard({ quest }: { quest: FounderQuest }) {
  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-violet/15 bg-white p-6 shadow-card">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet">
            <Target className="size-4" />
            Today&apos;s Quest
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{quest.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">{quest.description}</p>
        </div>
        <VerificationBadge quest={quest} />
      </div>
      <QuestCard quest={quest} variant="primary" />
    </section>
  );
}

export function WeeklyQuestSummary({ quests, weeklyOutcome }: { quests: FounderQuest[]; weeklyOutcome: string }) {
  const verifiedCount = quests.filter((quest) => quest.done).length;
  return (
    <section className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-moss">This Week</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">{weeklyOutcome}</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            {verifiedCount} of {quests.length} outcomes are already backed by project state or evidence.
          </p>
        </div>
        <Link href="#weekly-quests" className="inline-flex min-h-10 items-center justify-center rounded-full bg-cream px-4 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:bg-gold">
          View weekly quests
        </Link>
      </div>
      <div id="weekly-quests" className="mt-5 grid gap-3">
        {quests.map((quest) => <QuestCard key={quest.id} quest={quest} variant="compact" />)}
      </div>
    </section>
  );
}

export function QuestPanel({ title, quests, tone, weeklyOutcome }: { title: string; quests: FounderQuest[]; tone: "violet" | "moss"; weeklyOutcome?: string }) {
  const verified = quests.filter((quest) => quest.done).length;
  return (
    <div className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-black uppercase tracking-[.16em] ${tone === "violet" ? "text-violet" : "text-moss"}`}>{title}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{verified}/{quests.length} evidence-backed</h2>
          {weeklyOutcome && <p className="mt-2 text-sm leading-6 text-ink/60">{weeklyOutcome}</p>}
        </div>
        <ClipboardCheck className="size-7 text-gold" />
      </div>
      <div className="mt-5 grid gap-3">
        {quests.length === 0 ? (
          <p className="rounded-2xl bg-cream/70 p-5 text-sm leading-6 text-ink/60">Create or open a project to receive focused quests.</p>
        ) : quests.map((quest) => <QuestCard key={quest.id} quest={quest} variant="compact" />)}
      </div>
    </div>
  );
}

export function QuestCard({ quest, variant = "compact" }: QuestCardProps) {
  const storageKey = `prismforge_quest_completion_${quest.id}`;
  const replacementKey = `prismforge_quest_replaced_${quest.projectId}_${quest.cadence}_${quest.periodKey}`;
  const [stored, setStored] = useState<StoredQuestCompletion | null>(null);
  const [detail, setDetail] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [replacementUsed, setReplacementUsed] = useState(false);
  const [fallbackText, setFallbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [awardMessage, setAwardMessage] = useState("");
  const mountedRef = useRef(true);

  const logQuestEvent = useCallback(async (eventName: string) => {
    try {
      await fetch("/api/beta-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventName,
          metadata: {
            quest_id: quest.id,
            project_id: quest.projectId,
            cadence: quest.cadence,
            category: quest.category,
            verification_method: quest.verificationMethod,
            source: quest.source,
            project_status: quest.metadata.projectStatus,
          },
        }),
      });
    } catch {
      // Analytics must never block quest actions.
    }
  }, [quest.cadence, quest.category, quest.id, quest.metadata.projectStatus, quest.projectId, quest.source, quest.verificationMethod]);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setStored(JSON.parse(raw) as StoredQuestCompletion);
      setReplacementUsed(window.localStorage.getItem(replacementKey) === "1");
      const viewedKey = `prismforge_quest_viewed_${quest.id}`;
      if (!window.sessionStorage.getItem(viewedKey)) {
        window.sessionStorage.setItem(viewedKey, "1");
        void logQuestEvent("quest_viewed");
      }
    } catch {
      setStored(null);
    }
  }, [logQuestEvent, quest.id, replacementKey, storageKey]);

  const completed = quest.done || stored?.status === "completed";
  const manuallyDone = stored?.status === "completed" && !quest.done;
  const canManualComplete = quest.verificationMethod === "manual_with_detail" || quest.verificationMethod === "hybrid";
  const detailReady = detail.trim().length >= 12;
  const shortVariant = variant === "compact";

  const helper = useMemo(() => {
    if (quest.done) return "Verified from project state or Proof Board evidence.";
    if (canManualComplete) return "Not automatically verifiable yet. Add a short note about what happened.";
    return "Complete this by updating the project or Proof Board, then refresh.";
  }, [canManualComplete, quest.done]);

  function saveCompletion(payload: StoredQuestCompletion) {
    setStored(payload);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      setFallbackText(`${payload.status.toUpperCase()}: ${payload.detail}`);
    }
    void logQuestEvent(payload.status === "completed" ? (quest.done ? "quest_completion_verified" : "quest_completed_manually") : payload.status === "skipped" ? "quest_skipped" : "quest_replaced");
  }

  async function completeManually() {
    if (!detailReady) return;
    await submitCompletion(detail.trim());
  }

  async function submitCompletion(completionDetail = "") {
    setSubmitting(true);
    setAwardMessage("");
    try {
      const result = await completeFounderQuest({ projectId: quest.projectId, questId: quest.id, detail: completionDetail });
      if (!mountedRef.current) return;
      saveCompletion({ questId: quest.id, status: "completed", detail: completionDetail || "Verified from current project state.", completedAt: new Date().toISOString() });
      setAwardMessage(result.duplicate ? "Progress was already recorded for this quest." : `+${result.awardedXp} founder XP recorded.`);
      setShowManual(false);
    } catch (error) {
      if (!mountedRef.current) return;
      setAwardMessage(error instanceof Error ? error.message : "Progress could not be recorded yet.");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  function skipQuest() {
    if (skipReason.trim().length < 8) return;
    saveCompletion({ questId: quest.id, status: "skipped", detail: skipReason.trim().slice(0, 500), completedAt: new Date().toISOString() });
    setShowSkip(false);
  }

  function useAlternative() {
    const alternative = quest.alternatives?.[0];
    if (!alternative || replacementUsed) return;
    try {
      window.localStorage.setItem(replacementKey, "1");
    } catch {
      // Local replacement limits are a convenience; failure should not block the user.
    }
    setReplacementUsed(true);
    saveCompletion({
      questId: quest.id,
      status: "replaced",
      detail: "Used a smaller relevant alternative for the same strategic priority.",
      completedAt: new Date().toISOString(),
      alternativeTitle: alternative.title,
    });
  }

  return (
    <article className={`rounded-[1.5rem] border p-4 transition ${completed ? "border-moss/20 bg-lime/20" : "border-ink/10 bg-cream/55"} ${shortVariant ? "" : "mt-5"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`grid size-9 shrink-0 place-items-center rounded-2xl ${completed ? "bg-moss text-white" : "bg-white text-ink/45"}`}>
              {completed ? <CheckCircle2 className="size-5" /> : <Lightbulb className="size-5" />}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-ink/50">{quest.cadence}</span>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-violet">{quest.category}</span>
          </div>
          {shortVariant ? <h3 className="mt-3 font-bold leading-6 text-ink">{quest.title}</h3> : null}
          <p className="mt-2 text-sm leading-6 text-ink/65">{shortVariant ? quest.description : quest.whyItMatters}</p>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-ink/65">
            <p><span className="font-black text-ink">Done when:</span> {quest.completionRequirement}</p>
            <p><span className="font-black text-ink">Verification:</span> {helper}</p>
            <p><span className="font-black text-ink">Time:</span> {quest.estimatedTime}</p>
          </div>
          {stored?.status === "replaced" && stored.alternativeTitle && (
            <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold leading-6 text-ink/70">Alternative selected: {stored.alternativeTitle}</p>
          )}
          {manuallyDone && <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold leading-6 text-moss">Manual completion saved in this browser. Add Proof Board evidence when possible.</p>}
          {awardMessage && <p aria-live="polite" className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold leading-6 text-ink/70">{awardMessage}</p>}
          {fallbackText && <textarea className="mt-3 w-full rounded-2xl border border-ink/10 bg-white p-3 text-xs text-ink/70" readOnly value={fallbackText} />}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
          <Link href={quest.href} onClick={() => void logQuestEvent("quest_started")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet">
            {quest.primaryCta}
            <ArrowUpRight className="size-4" />
          </Link>
          {quest.done && !stored && (
            <button type="button" disabled={submitting} onClick={() => void submitCompletion()} className="inline-flex min-h-10 items-center justify-center rounded-full bg-moss px-4 text-sm font-black text-white disabled:opacity-50">
              {submitting ? "Recording..." : "Record verified progress"}
            </button>
          )}
          {!completed && canManualComplete && (
            <button type="button" onClick={() => setShowManual((value) => !value)} className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-black text-ink ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:bg-gold">
              Add completion note
            </button>
          )}
          {!completed && quest.alternatives?.length && !replacementUsed ? (
            <button type="button" onClick={useAlternative} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-ink/65 ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:bg-cream">
              <RefreshCcw className="size-4" />
              Smaller option
            </button>
          ) : null}
          {!completed && (
            <button type="button" onClick={() => setShowSkip((value) => !value)} className="inline-flex min-h-10 items-center justify-center rounded-full bg-transparent px-4 text-sm font-black text-ink/45 transition hover:text-coral">
              Skip
            </button>
          )}
        </div>
      </div>

      {showManual && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
          <label className="text-sm font-black text-ink" htmlFor={`${quest.id}-detail`}>What did you complete?</label>
          <textarea
            id={`${quest.id}-detail`}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-2xl border border-ink/10 bg-cream/40 p-3 text-sm outline-none focus:border-violet"
            placeholder="Example: I wrote five questions and sent the first two DMs."
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!detailReady || submitting} onClick={() => void completeManually()} className="inline-flex min-h-10 items-center justify-center rounded-full bg-moss px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
              {submitting ? "Verifying..." : "Save completion"}
            </button>
            <button type="button" onClick={() => setShowManual(false)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-4 text-sm font-black text-ink/50">
              <X className="size-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {showSkip && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
          <label className="text-sm font-black text-ink" htmlFor={`${quest.id}-skip`}>Why does this quest not fit today?</label>
          <textarea
            id={`${quest.id}-skip`}
            value={skipReason}
            onChange={(event) => setSkipReason(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-2xl border border-ink/10 bg-cream/40 p-3 text-sm outline-none focus:border-violet"
            placeholder="Example: I cannot contact people today, so I need a quieter prep task."
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={skipReason.trim().length < 8} onClick={skipQuest} className="inline-flex min-h-10 items-center justify-center rounded-full bg-ink px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
              Save skip reason
            </button>
            <button type="button" onClick={() => setShowSkip(false)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-4 text-sm font-black text-ink/50">
              <X className="size-4" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function VerificationBadge({ quest }: { quest: FounderQuest }) {
  const label = quest.verificationMethod === "evidence_record"
    ? "Proof Board verifies this"
    : quest.verificationMethod === "system_state"
      ? "Project state verifies this"
      : quest.verificationMethod === "hybrid"
        ? "Note + evidence preferred"
        : "Completion note required";
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-xs font-black uppercase tracking-[.12em] text-ink/60">
      <ShieldCheck className="size-4 text-moss" />
      {label}
    </div>
  );
}
