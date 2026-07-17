"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, Copy, Rocket, ShieldAlert, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SprintTaskOutput } from "@/lib/founder-os/executionTools";
import { calculateLaunchReadiness, LAUNCH_CHECKLIST_GROUPS } from "@/lib/founder-os/launchReadiness";
import type { BusinessType, OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import type { ProofSummary } from "@/lib/proof-board";
import type { ValidationBlocker } from "@/lib/founder-os/validationReadiness";

export function LaunchCommandCenter({
  projectId,
  title,
  status,
  score,
  businessType,
  targetCustomer,
  report,
  sprintTasks,
  validationProof,
  validationBlockers,
}: {
  projectId: string;
  title: string;
  status: ProjectStatus;
  score?: number | null;
  businessType: BusinessType;
  targetCustomer: string;
  report: OpportunityReport;
  sprintTasks?: SprintTaskOutput[];
  validationProof?: ProofSummary;
  validationBlockers?: ValidationBlocker[];
}) {
  const storageKey = `prismforge_launch_checklist_${projectId}`;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [liveValidationProof, setLiveValidationProof] = useState<ProofSummary | undefined>(validationProof);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [fallbackText, setFallbackText] = useState("");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLiveValidationProof(validationProof);
  }, [validationProof]);

  const input = useMemo(
    () => ({ title, status, score, businessType, targetCustomer, report, sprintTasks, validationProof: liveValidationProof, validationBlockers }),
    [businessType, liveValidationProof, report, score, sprintTasks, status, targetCustomer, title, validationBlockers],
  );
  const readiness = useMemo(() => calculateLaunchReadiness(input, checkedItems), [checkedItems, input]);

  useEffect(() => {
    function loadChecklist() {
      try {
        const saved = window.localStorage.getItem(storageKey);
        setCheckedItems(saved ? safeChecklistParse(saved) : {});
      } catch {
        setCheckedItems({});
      } finally {
        setHasLoaded(true);
      }
    }

    loadChecklist();

    function onStorage(event: StorageEvent) {
      if (event.key === storageKey) loadChecklist();
    }

    function onChecklistUpdated(event: Event) {
      const custom = event as CustomEvent<{ projectId?: string; checkedItems?: Record<string, boolean> }>;
      if (custom.detail?.projectId !== projectId || !custom.detail.checkedItems) return;
      setCheckedItems(custom.detail.checkedItems);
    }

    function onProofSummaryUpdated(event: Event) {
      const custom = event as CustomEvent<{ projectId?: string; summary?: ProofSummary }>;
      if (custom.detail?.projectId !== projectId || !custom.detail.summary) return;
      setLiveValidationProof(custom.detail.summary);
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("prismforge:launch-checklist-updated", onChecklistUpdated);
    window.addEventListener("prismforge:proof-summary-updated", onProofSummaryUpdated);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("prismforge:launch-checklist-updated", onChecklistUpdated);
      window.removeEventListener("prismforge:proof-summary-updated", onProofSummaryUpdated);
    };
  }, [projectId, storageKey]);

  useEffect(() => {
    try {
      if (!hasLoaded) return;
      window.localStorage.setItem(storageKey, JSON.stringify(checkedItems));
      window.dispatchEvent(new CustomEvent("prismforge:launch-checklist-updated", { detail: { projectId, checkedItems } }));
    } catch {
      // Local persistence should never break the launch workspace.
    }
  }, [checkedItems, hasLoaded, projectId, storageKey]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  function toggleItem(itemId: string) {
    setCheckedItems((current) => {
      const next = { ...current, [itemId]: !current[itemId] };
      return next;
    });
  }

  async function copyValue(value: string) {
    const didCopy = await copyTextToClipboard(value);
    setCopyState(didCopy ? "copied" : "failed");
    setFallbackText(didCopy ? "" : value);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setCopyState("idle"), 1800);
  }

  return (
    <section id="launch-command-center" className="mt-8 overflow-hidden rounded-[2rem] border border-ink/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet">
            <Rocket className="size-4" />
            Launch Command Center
          </p>
          <h2 className="mt-2 break-words font-display text-3xl font-semibold tracking-tight sm:text-4xl">Turn this opportunity into a testable private-alpha launch.</h2>
        </div>
        <span className="rounded-full bg-lime/30 px-4 py-2 text-xs font-black uppercase tracking-[.14em] text-moss">{readiness.label}</span>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="grid gap-5">
          <div className="rounded-[1.75rem] border border-ink/10 bg-gradient-to-br from-cream to-lime/20 p-5">
            <p className="text-xs font-black uppercase tracking-[.16em] text-moss">Launch readiness</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-6xl font-semibold">{readiness.score}</p>
                <p className="text-sm font-black uppercase tracking-[.12em] text-ink/45">/100</p>
              </div>
              <CheckCircle2 className="size-10 text-moss" />
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-gradient-to-r from-violet via-moss to-gold transition-all duration-700" style={{ width: `${readiness.score}%` }} />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-ink/10 bg-ink p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[.16em] text-gold">Launch verdict</p>
            <h3 className="mt-3 font-display text-3xl font-semibold">{readiness.verdict}</h3>
            <p className="mt-3 text-sm leading-6 text-white/65">{readiness.explanation}</p>
          </div>

          <div className="rounded-[1.75rem] border border-ink/10 bg-white p-5">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-coral">
              <ShieldAlert className="size-4" />
              Blockers before launch
            </p>
            <div className="mt-4 grid gap-2 text-sm leading-6 text-ink/65">
              {readiness.blockerDetails.length ? readiness.blockerDetails.map((blocker) => (
                <Link key={blocker.id} href={blocker.href} className="rounded-2xl bg-coral/10 p-3 font-semibold text-ink/70 transition hover:bg-coral/20"><span className="block">{blocker.label}</span><span className="mt-1 block text-xs font-normal text-ink/50">Resolve: {blocker.resolutionCondition}</span></Link>
              )) : readiness.blockers.length ? readiness.blockers.map((blocker) => (
                <div key={blocker} className="rounded-2xl bg-coral/10 p-3 font-semibold text-ink/70">{blocker}</div>
              )) : <div className="rounded-2xl bg-lime/25 p-3 font-semibold text-moss">Looks alpha-ready. Your next move is inviting testers.</div>}
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[1.75rem] border border-ink/10 bg-cream/50 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Launch checklist</p>
                <p className="mt-1 text-sm font-semibold text-ink/55">{readiness.completedCount}/{readiness.totalCount} complete</p>
              </div>
              {!hasLoaded && <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-ink/45">Loading checklist...</span>}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {LAUNCH_CHECKLIST_GROUPS.map((group) => (
                <div key={group.title} className="rounded-2xl bg-white p-4">
                  <p className="font-display text-xl font-semibold">{group.title}</p>
                  <div className="mt-4 grid gap-2">
                    {group.items.map((item) => (
                      <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 text-sm font-semibold text-ink/70 transition hover:bg-cream">
                        <input
                          type="checkbox"
                          checked={Boolean(checkedItems[item.id])}
                          onChange={() => toggleItem(item.id)}
                          className="mt-1 size-4 rounded border-ink/20 accent-moss"
                        />
                        <span className="break-words">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CopyPanel
              icon={<ClipboardList className="size-5" />}
              title="Copy Launch Plan"
              description="Includes score, verdict, blockers, checklist progress, next action, channel, and invite."
              buttonLabel="Copy Launch Plan"
              onCopy={() => copyValue(readiness.launchPlan)}
            />
            <CopyPanel
              icon={<Users className="size-5" />}
              title="Tester Invite Message"
              description={readiness.testerInvite}
              buttonLabel="Copy Invite"
              onCopy={() => copyValue(readiness.testerInvite)}
            />
          </div>

          <div className="rounded-[1.75rem] border border-violet/15 bg-violet/10 p-5">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet">
              <Sparkles className="size-4" />
              Suggested first channel
            </p>
            <p className="mt-3 break-words text-sm font-semibold leading-6 text-ink/70">{readiness.firstChannel}</p>
          </div>

          {copyState === "copied" && <p className="text-sm font-semibold text-moss">Copied.</p>}
          {copyState === "failed" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Clipboard failed. Copy manually:</p>
              <textarea readOnly value={fallbackText} className="mt-3 min-h-40 w-full rounded-2xl border border-amber-200 bg-white p-3 text-xs leading-6 text-ink/70" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function safeChecklistParse(value: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, checked]) => typeof checked === "boolean")) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function CopyPanel({
  icon,
  title,
  description,
  buttonLabel,
  onCopy,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-ink/10 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/20 text-ink">{icon}</div>
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold">{title}</p>
          <p className="mt-2 break-words text-sm leading-6 text-ink/55">{description}</p>
        </div>
      </div>
      <Button type="button" onClick={onCopy} className="mt-5 gap-2">
        <Copy className="size-4" />
        {buttonLabel}
      </Button>
    </div>
  );
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Try textarea fallback below.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const didCopy = document.execCommand("copy");
    document.body.removeChild(textarea);
    return didCopy;
  } catch {
    return false;
  }
}
