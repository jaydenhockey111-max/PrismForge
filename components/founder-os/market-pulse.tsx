"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Copy, Loader2, Radar, RefreshCcw, Sparkles } from "lucide-react";
import { logMarketPulseRefresh } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { buildLiveIntelligenceInput, type LiveIntelligenceResult, type MarketSignal, type MarketSignalSeverity } from "@/lib/founder-os/liveIntelligence";
import { generateMockMarketSignals } from "@/lib/founder-os/liveIntelligenceProviders";
import type { BusinessType, OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";

const MARKET_PULSE_COOLDOWN_MS = 10 * 60 * 1000;

export function MarketPulse({
  projectId,
  projectTitle,
  businessType,
  targetCustomer,
  status,
  score,
  report,
}: {
  projectId: string;
  projectTitle: string;
  businessType: BusinessType;
  targetCustomer: string;
  status: ProjectStatus;
  score?: number | null;
  report: OpportunityReport;
}) {
  const storageKey = `prismforge_market_pulse_${projectId}`;
  const input = useMemo(() => buildLiveIntelligenceInput({ projectTitle, businessType, targetCustomer, status, score, report }), [businessType, projectTitle, report, score, status, targetCustomer]);
  const [pulse, setPulse] = useState<LiveIntelligenceResult>(() => generateMockMarketSignals(input));
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const cooldownRemaining = lastChecked ? Math.max(0, MARKET_PULSE_COOLDOWN_MS - (Date.now() - new Date(lastChecked).getTime())) : 0;
  const canRefresh = cooldownRemaining <= 0 && !scanning;

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { result?: LiveIntelligenceResult; lastChecked?: string };
        if (parsed.result) setPulse(parsed.result);
        if (parsed.lastChecked) setLastChecked(parsed.lastChecked);
      }
    } catch {
      // Bad cache should never block project rendering.
    }
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function refreshPulse() {
    if (!canRefresh) {
      setTemporaryMessage(`Market Pulse cooldown active. Try again in ${Math.ceil(cooldownRemaining / 60000)} minute(s).`);
      return;
    }

    setScanning(true);
    setTemporaryMessage("Refreshing local Market Pulse preview...");
    const logged = await logMarketPulseRefresh(projectId);
    if (!logged.ok) {
      setScanning(false);
      setTemporaryMessage(logged.reason ?? "Market Pulse cooldown active.");
      return;
    }
    window.setTimeout(() => {
      const checkedAt = new Date().toISOString();
      const result = generateMockMarketSignals(input, checkedAt);
      setPulse(result);
      setLastChecked(checkedAt);
      window.localStorage.setItem(storageKey, JSON.stringify({ result, lastChecked: checkedAt }));
      setScanning(false);
      setTemporaryMessage("Local Market Pulse preview refreshed.");
    }, 700);
  }

  function dismissSignal(signalId: string) {
    const next = { ...pulse, signals: pulse.signals.filter((signal) => signal.id !== signalId) };
    setPulse(next);
    window.localStorage.setItem(storageKey, JSON.stringify({ result: next, lastChecked }));
  }

  function setTemporaryMessage(nextMessage: string) {
    setMessage(nextMessage);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setMessage(null), 2600);
  }

  return (
    <section id="market-pulse" className="mt-8 overflow-hidden rounded-[2rem] border border-ink/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet">
            <Radar className="size-4" />
            Local Market Pulse preview
          </p>
          <h2 className="mt-2 break-words font-display text-3xl font-semibold tracking-tight sm:text-4xl">Founder Intelligence Preview</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">
            Market Pulse currently uses saved project context and local deterministic signals only. It does not run external web search or background monitoring during beta.
          </p>
        </div>
        <Button type="button" onClick={refreshPulse} disabled={scanning} className="gap-2">
          {scanning ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Refresh local preview
        </Button>
      </div>

      {message && <div className="mt-5 rounded-2xl border border-violet/15 bg-violet/10 p-4 text-sm font-semibold text-violet">{message}</div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="rounded-[1.75rem] border border-ink/10 bg-ink p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[.16em] text-gold">Local Founder Brief</p>
          <h3 className="mt-3 font-display text-3xl font-semibold">{pulse.summary.statusLabel}</h3>
          <p className="mt-3 text-sm leading-6 text-white/65">{pulse.summary.dailyBrief}</p>
          <div className="mt-5 grid gap-3 text-sm">
            <Metric label="Signals" value={pulse.summary.totalSignals} />
            <Metric label="Highest severity" value={pulse.summary.highestSeverity} />
            <Metric label="Avg. local fit" value={`${pulse.summary.averageConfidence}%`} />
            <Metric label="Last checked" value={lastChecked ? new Date(lastChecked).toLocaleString() : "Local preview"} />
          </div>
        </div>

        {pulse.signals.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-ink/20 bg-cream/60 p-8 text-center">
            <Sparkles className="mx-auto size-8 text-violet" />
            <h3 className="mt-4 font-display text-2xl font-semibold">No active signals.</h3>
            <p className="mt-2 text-sm leading-6 text-ink/60">Refresh the local preview to generate project-scoped founder intelligence.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pulse.signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} onDismiss={() => dismissSignal(signal.id)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SignalCard({ signal, onDismiss }: { signal: MarketSignal; onDismiss: () => void }) {
  return (
    <article className="rounded-[1.5rem] border border-ink/10 bg-cream/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet">{signal.category}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${severityClass(signal.severity)}`}>{signal.severity}</span>
      </div>
      <h3 className="mt-4 break-words font-display text-2xl font-semibold leading-tight">{signal.title}</h3>
      <p className="mt-3 text-sm leading-6 text-ink/60">{signal.explanation}</p>
      <div className="mt-4 rounded-2xl bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[.14em] text-moss">Suggested action</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-ink/70">{signal.suggestedAction}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-ink/45">
        <span>{signal.sourceLabel} · {signal.confidence}% local fit · not external evidence</span>
        <div className="flex gap-2">
          <CopySignalButton text={`${signal.title}\n\n${signal.explanation}\n\nAction: ${signal.suggestedAction}`} />
          <button type="button" onClick={onDismiss} className="rounded-full px-3 py-2 hover:bg-white hover:text-ink">Dismiss</button>
        </div>
      </div>
    </article>
  );
}

function CopySignalButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await copyTextToClipboard(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-full px-3 py-2 hover:bg-white hover:text-ink"
    >
      <Copy className="size-3.5" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-xs font-black uppercase tracking-[.14em] text-white/35">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function severityClass(severity: MarketSignalSeverity) {
  if (severity === "High") return "bg-coral/15 text-coral";
  if (severity === "Medium") return "bg-gold/25 text-ink";
  return "bg-lime/30 text-moss";
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Try fallback below.
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
