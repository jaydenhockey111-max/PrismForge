"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, CheckCircle2, ClipboardList, DollarSign, Loader2, Swords, Video, Zap } from "lucide-react";
import { generateExecutionOutput } from "@/app/(app)/projects/actions";
import type { Json, ProjectOutputType } from "@/lib/database.types";
import type { OpportunityReport } from "@/lib/founder-os/types";
import {
  generateCompetitiveBattlecard,
  generatePricingTiers,
  generateSprintTasks,
  generateValidationSurvey,
  generateVideoScripts,
  type CompetitiveBattlecardRow,
  type PricingTierOutput,
  type SprintTaskOutput,
  type ValidationSurveyOutput,
} from "@/lib/founder-os/executionTools";

type ToolState<T> = {
  pending: boolean;
  output: T | null;
  saved: boolean;
  error: string | null;
  mode: "openai" | "mock" | "cache" | null;
  fallbackReason: string | null;
  durationMs: number | null;
};

export function ValidationSurveyTool({ projectId, report, savedOutput }: { projectId: string; report: OpportunityReport; savedOutput?: Json }) {
  const [state, setState] = useToolState<ValidationSurveyOutput>(savedOutput as ValidationSurveyOutput | undefined);
  return (
    <ExecutionToolCard
      eyebrow="Research AI"
      title="Validate demand before you build."
      description={`Turn ${report.summary.title} into a survey and outreach message for talking to potential users.`}
      expectedOutput="5-question survey + cold outreach message."
      useCase="Use this before building more features or when customer pain feels fuzzy."
      hint="Best first move: send the outreach message to 5 real people."
      eta="~20-45 sec"
      button="⚡ Generate Validation Survey"
      loading="Research AI drafting validation questions..."
      pending={state.pending}
      saved={state.saved}
      error={state.error}
      mode={state.mode}
      fallbackReason={state.fallbackReason}
      durationMs={state.durationMs}
      icon={<ClipboardList className="size-5" />}
      onGenerate={() => { if (state.pending) return; if (state.output && !confirmRegenerate()) return; void runTool({ projectId, outputType: "validation_survey", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
      onRetry={() => { if (state.pending) return; logClientEvent("ai_employee_retry_clicked", projectId, { employee: "validation_survey" }); void runTool({ projectId, outputType: "validation_survey", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
    >
      {state.output && <ValidationSurveyOutputView output={state.output} />}
    </ExecutionToolCard>
  );
}

export function CompetitiveBattlecardTool({ projectId, report, savedOutput }: { projectId: string; report: OpportunityReport; savedOutput?: Json }) {
  const [state, setState] = useToolState<CompetitiveBattlecardRow[]>(savedOutput as CompetitiveBattlecardRow[] | undefined);
  return (
    <ExecutionToolCard
      eyebrow="Analyst AI"
      title="Know exactly how to win."
      description={`Convert ${report.competitors.length || 2} competitor signals into a crisp founder battlecard.`}
      expectedOutput="Competitor matrix + exact counter-advantage."
      useCase="Use this when you need sharper positioning before a launch page or pitch."
      hint="Look for one weakness you can prove better than competitors."
      eta="~20-45 sec"
      button="⚡ Generate Competitive Battlecard"
      loading="Analyst AI mapping competitors..."
      pending={state.pending}
      saved={state.saved}
      error={state.error}
      mode={state.mode}
      fallbackReason={state.fallbackReason}
      durationMs={state.durationMs}
      icon={<Swords className="size-5" />}
      onGenerate={() => { if (state.pending) return; if (state.output && !confirmRegenerate()) return; void runTool({ projectId, outputType: "competitive_battlecard", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
      onRetry={() => { if (state.pending) return; logClientEvent("ai_employee_retry_clicked", projectId, { employee: "competitive_battlecard" }); void runTool({ projectId, outputType: "competitive_battlecard", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
    >
      {state.output && <BattlecardOutput rows={state.output} />}
    </ExecutionToolCard>
  );
}

export function PricingTiersTool({ projectId, report, savedOutput }: { projectId: string; report: OpportunityReport; savedOutput?: Json }) {
  const [state, setState] = useToolState<PricingTierOutput[]>(savedOutput as PricingTierOutput[] | undefined);
  return (
    <ExecutionToolCard
      eyebrow="Copywriter AI"
      title="Package the value into tiers."
      description={`Create pricing around why users pay: ${report.monetizationPlan.whyUsersWouldPay}`}
      expectedOutput="Free, Pro, and Founder/Team tiers with feature breakdowns."
      useCase="Use this when your value is clear but the offer still feels vague."
      hint="Beta note: treat these as pricing hypotheses, not final promises."
      eta="~15-40 sec"
      button="⚡ Generate Pricing Tiers"
      loading="Copywriter AI building pricing..."
      pending={state.pending}
      saved={state.saved}
      error={state.error}
      mode={state.mode}
      fallbackReason={state.fallbackReason}
      durationMs={state.durationMs}
      icon={<DollarSign className="size-5" />}
      onGenerate={() => { if (state.pending) return; if (state.output && !confirmRegenerate()) return; void runTool({ projectId, outputType: "pricing_tiers", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
      onRetry={() => { if (state.pending) return; logClientEvent("ai_employee_retry_clicked", projectId, { employee: "pricing_tiers" }); void runTool({ projectId, outputType: "pricing_tiers", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
    >
      {state.output && <PricingOutput tiers={state.output} />}
    </ExecutionToolCard>
  );
}

export function VideoScriptsTool({ projectId, report, savedOutput }: { projectId: string; report: OpportunityReport; savedOutput?: Json }) {
  const [state, setState] = useToolState<ReturnType<typeof generateVideoScripts>>(savedOutput as ReturnType<typeof generateVideoScripts> | undefined);
  return (
    <ExecutionToolCard
      eyebrow="Marketer AI"
      title="Turn the plan into short-form scripts."
      description={`Generate hook-first video concepts for ${report.summary.targetCustomer}.`}
      expectedOutput="Three short-form script samples with hook, body, and CTA."
      useCase="Use this when you need launch content but do not know what to post."
      hint="Film the simplest hook first. Momentum beats perfect editing."
      eta="~25-50 sec"
      button="⚡ Generate 30-Day Video Scripts"
      loading="Marketer AI drafting viral scripts..."
      pending={state.pending}
      saved={state.saved}
      error={state.error}
      mode={state.mode}
      fallbackReason={state.fallbackReason}
      durationMs={state.durationMs}
      icon={<Video className="size-5" />}
      onGenerate={() => { if (state.pending) return; if (state.output && !confirmRegenerate()) return; void runTool({ projectId, outputType: "video_scripts", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
      onRetry={() => { if (state.pending) return; logClientEvent("ai_employee_retry_clicked", projectId, { employee: "video_scripts" }); void runTool({ projectId, outputType: "video_scripts", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
    >
      {state.output && <VideoScriptsOutput scripts={state.output} />}
    </ExecutionToolCard>
  );
}

export function SprintTasksTool({ projectId, report, savedOutput }: { projectId: string; report: OpportunityReport; savedOutput?: Json }) {
  const [state, setState] = useToolState<SprintTaskOutput[]>(savedOutput as SprintTaskOutput[] | undefined);
  return (
    <ExecutionToolCard
      eyebrow="Operator AI"
      title="Remove founder paralysis."
      description={`Break ${report.summary.title} into the next three concrete actions for this week.`}
      expectedOutput="Three concrete sprint tasks with why each one matters."
      useCase="Use this when the project feels too big and you need this week's moves."
      hint="Finish Task 1 before generating more strategy."
      eta="~15-35 sec"
      button="⚡ Generate Actionable Sprint Tasks"
      loading="Operator AI breaking this into tasks..."
      pending={state.pending}
      saved={state.saved}
      error={state.error}
      mode={state.mode}
      fallbackReason={state.fallbackReason}
      durationMs={state.durationMs}
      icon={<BarChart3 className="size-5" />}
      onGenerate={() => { if (state.pending) return; if (state.output && !confirmRegenerate()) return; void runTool({ projectId, outputType: "sprint_tasks", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
      onRetry={() => { if (state.pending) return; logClientEvent("ai_employee_retry_clicked", projectId, { employee: "sprint_tasks" }); void runTool({ projectId, outputType: "sprint_tasks", setState, regenerate: Boolean(state.output), currentOutput: state.output }); }}
    >
      {state.output && <SprintOutput tasks={state.output} />}
    </ExecutionToolCard>
  );
}

function useToolState<T>(initialOutput?: T): [ToolState<T>, (state: ToolState<T>) => void] {
  const state = useState<ToolState<T>>({ pending: false, output: initialOutput ?? null, saved: Boolean(initialOutput), error: null, mode: initialOutput ? "cache" : null, fallbackReason: null, durationMs: null });
  useEffect(() => {
    if (initialOutput) logClientEvent("ai_employee_cache_hit", null, { employee: "execution_suite" });
  }, [initialOutput]);
  return state;
}

async function runTool<T>({
  projectId,
  outputType,
  setState,
  regenerate,
  currentOutput,
}: {
  projectId: string;
  outputType: ProjectOutputType;
  setState: (state: ToolState<T>) => void;
  regenerate: boolean;
  currentOutput?: T | null;
}) {
  const startedAt = performance.now();
  logClientEvent("ai_employee_started", projectId, { employee: outputType, regenerate });
  setState({ pending: true, output: currentOutput ?? null, saved: Boolean(currentOutput), error: null, mode: null, fallbackReason: null, durationMs: null });
  try {
    const result = await generateExecutionOutput(projectId, outputType, regenerate, crypto.randomUUID());
    const durationMs = Math.round(performance.now() - startedAt);
    setState({ pending: false, output: result.output as T, saved: true, error: null, mode: result.mode, fallbackReason: result.fallbackReason, durationMs });
    logClientEvent(result.mode === "cache" ? "ai_employee_cache_hit" : "ai_employee_completed", projectId, { employee: outputType, source: result.mode, duration_ms: durationMs });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const friendlyError = friendlyAiError(error);
    setState({ pending: false, output: currentOutput ?? null, saved: Boolean(currentOutput), error: friendlyError.message, mode: null, fallbackReason: null, durationMs });
    logClientEvent("ai_employee_failed", projectId, { employee: outputType, error_category: friendlyError.category, duration_ms: durationMs });
  }
}

function ExecutionToolCard({
  eyebrow,
  title,
  description,
  expectedOutput,
  useCase,
  hint,
  eta,
  button,
  loading,
  pending,
  saved,
  error,
  mode,
  fallbackReason,
  durationMs,
  icon,
  onGenerate,
  onRetry,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  expectedOutput: string;
  useCase: string;
  hint: string;
  eta: string;
  button: string;
  loading: string;
  pending: boolean;
  saved: boolean;
  error: string | null;
  mode: "openai" | "mock" | "cache" | null;
  fallbackReason: string | null;
  durationMs: number | null;
  icon: ReactNode;
  onGenerate: () => void;
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-[1.75rem] border border-violet/15 bg-gradient-to-br from-ink via-ink to-violet p-5 text-white shadow-glow">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-gold">
            <Zap className="size-4" />
            {eyebrow}
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{description}</p>
          <div className="mt-4 grid gap-2 text-xs leading-5 text-white/70 sm:grid-cols-3">
            <InfoPill label="Output" value={expectedOutput} />
            <InfoPill label="Use when" value={useCase} />
            <InfoPill label="Est. time" value={eta} />
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={onGenerate}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-5 text-sm font-black text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80 lg:w-auto"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : icon}
          {pending ? loading : cleanButtonLabel(button, eyebrow)}
        </button>
      </div>
      <p className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-3 text-xs font-semibold leading-5 text-white/70">
        Context hint: {hint}
      </p>
      {pending ? (
        <div aria-live="polite" className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm font-semibold text-white/75">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span>{loading} One click = one generation. No background AI is running.</span>
        </div>
      ) : (
        <>
          {saved && <div className="mt-5 rounded-2xl border border-moss/30 bg-moss/15 p-3 text-xs font-black uppercase tracking-[.14em] text-lime">Saved to Founder CRM memory · {usageBadge(mode, fallbackReason)} · +10 XP on first save</div>}
          {fallbackReason && <div className="mt-3 rounded-2xl border border-gold/20 bg-gold/10 p-3 text-xs font-semibold text-gold">{fallbackReason}</div>}
          {durationMs && <div className="mt-3 rounded-2xl border border-white/10 bg-white/10 p-3 text-xs font-semibold text-white/65">Completed in {(durationMs / 1000).toFixed(1)} seconds.</div>}
          {error && (
            <div role="alert" className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
              <p>{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center justify-center rounded-full bg-red-900 px-4 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-ink"
              >
                Retry safely
              </button>
            </div>
          )}
          {children || <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm leading-6 text-white/65">Generate once you&apos;re ready. Output appears here and auto-saves to this project&apos;s CRM memory.</div>}
        </>
      )}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
      <p className="font-black uppercase tracking-[.14em] text-gold">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

function cleanButtonLabel(button: string, eyebrow: string) {
  if (button.includes("Validation")) return "Ask Validation AI";
  if (button.includes("Competitive")) return "Ask Analyst AI";
  if (button.includes("Pricing")) return "Ask Pricing AI";
  if (button.includes("Video")) return "Ask Video Scripts AI";
  if (button.includes("Sprint") || button.includes("Actionable")) return "Ask Sprint Planning AI";
  return eyebrow.includes("AI") ? `Ask ${eyebrow}` : button;
}

function confirmRegenerate() {
  return window.confirm("Regenerating uses AI credits. Continue?");
}

function usageBadge(mode: "openai" | "mock" | "cache" | null, fallbackReason?: string | null) {
  const reason = fallbackReason?.toLowerCase() ?? "";
  if (reason.includes("cooldown active")) return "Cooldown active";
  if (reason.includes("limit reached") || reason.includes("usage limit")) return "Limit reached";
  if (mode === "openai") return "Generated with AI";
  if (mode === "cache") return "Cached result";
  return "Local fallback";
}

function friendlyAiError(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  const message = raw.toLowerCase();
  if (message.includes("requires") || message.includes("plan")) {
    return { category: "plan_required", message: "This AI specialist is limited by your current plan. If this seems wrong, refresh and try again." };
  }
  if (message.includes("cooldown")) {
    return { category: "cooldown", message: "This specialist is cooling down for beta cost protection. The saved result is still available if one exists." };
  }
  if (message.includes("limit")) {
    return { category: "usage_limit", message: "This feature hit its beta usage limit. Try again later or use the saved output for now." };
  }
  if (message.includes("network") || message.includes("fetch")) {
    return { category: "network", message: "The request could not reach the server. Check your connection and retry." };
  }
  if (message.includes("not found")) {
    return { category: "not_found", message: "This project could not be found. Refresh the page and try again." };
  }
  return { category: "unknown", message: "Something interrupted generation. No extra AI call is running; you can retry safely." };
}

function ValidationSurveyOutputView({ output }: { output: ValidationSurveyOutput }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_.8fr]">
      <WhitePanel title="5-question survey template">
        <ol className="grid gap-3 text-sm leading-6 text-ink/65">
          {output.questions.map((question, index) => <li key={question}><span className="font-black text-violet">{index + 1}.</span> {question}</li>)}
        </ol>
      </WhitePanel>
      <WhitePanel title="Cold outreach message">
        <p className="text-sm leading-7 text-ink/65">{output.outreachMessage}</p>
        <CopyTextButton value={output.outreachMessage} />
      </WhitePanel>
    </div>
  );
}

function BattlecardOutput({ rows }: { rows: CompetitiveBattlecardRow[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white text-ink">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-cream text-xs uppercase tracking-wider text-ink/50"><tr><th className="px-4 py-3">Competitor</th><th className="px-4 py-3">Likely weakness</th><th className="px-4 py-3">Counter-advantage</th></tr></thead>
          <tbody className="divide-y divide-ink/10">
            {rows.map((row) => <tr key={row.competitor}><td className="px-4 py-4 font-bold">{row.competitor}</td><td className="px-4 py-4 text-ink/60">{row.likelyWeakness}</td><td className="px-4 py-4 text-moss">{row.counterAdvantage}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PricingOutput({ tiers }: { tiers: PricingTierOutput[] }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      {tiers.map((tier) => (
        <article key={tier.name} className="rounded-2xl border border-white/10 bg-white p-5 text-ink shadow-sm">
          <p className="text-xs font-black uppercase tracking-[.14em] text-violet">{tier.name}</p>
          <h4 className="mt-2 font-display text-3xl font-semibold">{tier.price}</h4>
          <p className="mt-2 text-sm leading-6 text-ink/55">{tier.positioning}</p>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-ink/65">
            {tier.features.map((feature) => <li key={feature} className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-moss" />{feature}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

function VideoScriptsOutput({ scripts }: { scripts: ReturnType<typeof generateVideoScripts> }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      {scripts.map((script) => (
        <article key={script.day} className="rounded-2xl border border-white/10 bg-white p-5 text-ink shadow-sm">
          <span className="rounded-full bg-violet/10 px-3 py-1 text-xs font-black text-violet">Day {script.day}</span>
          <ScriptBlock title="Hook" value={script.hook} accent="text-coral" />
          <ScriptBlock title="Body script" value={script.bodyScript} accent="text-moss" />
          <ScriptBlock title="CTA" value={script.cta} accent="text-violet" />
        </article>
      ))}
    </div>
  );
}

function SprintOutput({ tasks }: { tasks: SprintTaskOutput[] }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      {tasks.map((task) => (
        <article key={task.task} className="rounded-2xl border border-white/10 bg-white p-5 text-ink shadow-sm">
          <span className="rounded-full bg-gold/25 px-3 py-1 text-xs font-black text-ink">{task.category}</span>
          <h4 className="mt-4 font-display text-xl font-semibold leading-tight">{task.task}</h4>
          <p className="mt-3 text-sm leading-6 text-ink/60">{task.whyItMatters}</p>
        </article>
      ))}
    </div>
  );
}

function WhitePanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl bg-white p-5 text-ink"><h4 className="font-display text-xl font-semibold">{title}</h4><div className="mt-4">{children}</div></section>;
}

function ScriptBlock({ title, value, accent }: { title: string; value: string; accent: string }) {
  return <div className="mt-4"><p className={`text-xs font-black uppercase tracking-[.14em] ${accent}`}>{title}</p><p className="mt-1 text-sm leading-6 text-ink/65">{value}</p></div>;
}

function CopyTextButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const label = useMemo(() => copyFailed ? "Copy failed" : copied ? "Copied" : "Copy message", [copied, copyFailed]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={async () => {
        const didCopy = await copyTextToClipboard(value);
        setCopied(didCopy);
        setCopyFailed(!didCopy);
        if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = window.setTimeout(() => {
          setCopied(false);
          setCopyFailed(false);
        }, 1400);
      }}
      className="mt-4 rounded-full bg-ink px-4 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-moss"
    >
      {label}
    </button>
  );
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to document.execCommand.
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

function logClientEvent(
  eventName: "ai_employee_started" | "ai_employee_completed" | "ai_employee_failed" | "ai_employee_retry_clicked" | "ai_employee_cache_hit",
  projectId: string | null,
  metadata: Record<string, string | boolean | number>,
) {
  try {
    void fetch("/api/beta-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, metadata: { ...metadata, project_id: projectId } }),
      keepalive: true,
    });
  } catch {
    // Analytics must never block the user action.
  }
}
