"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, ClipboardCheck, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import {
  createValidationExperiment,
  deleteValidationExperiment,
  updateValidationExperiment,
} from "@/app/(app)/projects/proof-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { ProjectValidationExperiment } from "@/lib/database.types";
import {
  confidenceBand,
  starterExperimentTemplate,
  summarizeProof,
  validationChannels,
  validationEvidenceTypes,
  validationStatuses,
  type ValidationChannel,
  type ValidationExperimentInput,
  type ValidationStatus,
} from "@/lib/proof-board";
import { cn } from "@/lib/utils";

type FormState = ValidationExperimentInput & { revenue_dollars: string };

const emptyForm: FormState = {
  title: "",
  goal: "",
  status: "planned",
  channel: "DMs",
  hypothesis: "",
  target_audience: "",
  task_description: "",
  people_contacted: 0,
  replies: 0,
  pain_confirmed: 0,
  interested_users: 0,
  waitlist_signups: 0,
  payment_intent: 0,
  preorders_or_revenue_cents: 0,
  key_quotes: "",
  learnings: "",
  next_action: "",
  confidence_score: 0,
  validation_path_id: null,
  target_assumption_id: null,
  evidence_type: "other",
  decision_type: null,
  request_id: null,
  revenue_dollars: "",
};

export function ProofBoard({
  projectId,
  targetAudience,
  painPoint,
  initialExperiments,
  activePathId,
  targetAssumptionId,
  starterExperiment,
}: {
  projectId: string;
  targetAudience: string;
  painPoint: string;
  initialExperiments: ProjectValidationExperiment[];
  activePathId?: string | null;
  targetAssumptionId?: string | null;
  starterExperiment?: { title: string; goal: string; channel: ValidationChannel; hypothesis: string; taskDescription: string; evidenceType: (typeof validationEvidenceTypes)[number] };
}) {
  const router = useRouter();
  const [experiments, setExperiments] = useState<ProjectValidationExperiment[]>(initialExperiments);
  const [form, setForm] = useState<FormState>(() => ({ ...emptyForm, target_audience: targetAudience, validation_path_id: activePathId ?? null, target_assumption_id: targetAssumptionId ?? null }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(initialExperiments.length === 0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(() => summarizeProof(experiments), [experiments]);
  const starter = useMemo(() => starterExperiment ? { ...starterExperimentTemplate(targetAudience, painPoint), title: starterExperiment.title, goal: starterExperiment.goal, channel: starterExperiment.channel, hypothesis: starterExperiment.hypothesis, task_description: starterExperiment.taskDescription, evidence_type: starterExperiment.evidenceType, validation_path_id: activePathId ?? null, target_assumption_id: targetAssumptionId ?? null } : starterExperimentTemplate(targetAudience, painPoint), [activePathId, painPoint, starterExperiment, targetAssumptionId, targetAudience]);
  const missingEvidence = useMemo(() => nextEvidenceGaps(summary), [summary]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("prismforge:proof-summary-updated", { detail: { projectId, summary } }));
  }, [projectId, summary]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function beginCreateFromStarter() {
    void trackEvidenceStart(projectId, "starter");
    setEditingId(null);
    setForm({ ...emptyForm, ...starter, revenue_dollars: centsToDollars(starter.preorders_or_revenue_cents) });
    setIsFormOpen(true);
    setMessage("");
    setError("");
  }

  function beginEdit(experiment: ProjectValidationExperiment) {
    setEditingId(experiment.id);
    setForm(rowToForm(experiment));
    setIsFormOpen(true);
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, target_audience: targetAudience, validation_path_id: activePathId ?? null, target_assumption_id: targetAssumptionId ?? null });
    setIsFormOpen(false);
  }

  function submitForm() {
    setMessage("");
    setError("");
    const payload = formToPayload({ ...form, request_id: form.request_id ?? crypto.randomUUID() });

    startTransition(async () => {
      try {
        if (editingId) {
          const updated = await updateValidationExperiment(editingId, payload);
          setExperiments((current) => current.map((item) => (item.id === updated.id ? updated as ProjectValidationExperiment : item)));
          setMessage("Validation experiment updated.");
        } else {
          const created = await createValidationExperiment(projectId, payload);
          setExperiments((current) => [created as ProjectValidationExperiment, ...current]);
          setMessage("Validation experiment saved.");
        }
        resetForm();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "We could not save this experiment. Check the required fields, then try again.");
        void trackEvidenceError(projectId, editingId ? "update_failed" : "create_failed");
      }
    });
  }

  function removeExperiment(experimentId: string) {
    if (!window.confirm("Delete this validation experiment?")) return;
    setMessage("");
    setError("");

    startTransition(async () => {
      try {
        await deleteValidationExperiment(experimentId);
        setExperiments((current) => current.filter((item) => item.id !== experimentId));
        setMessage("Validation experiment deleted.");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "We could not delete this experiment. Refresh the page, then try again.");
      }
    });
  }

  return (
    <section id="proof-board" className="mt-8 overflow-hidden rounded-[2rem] border border-ink/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-moss">
            <ShieldCheck className="size-4" />
            Proof Board
          </p>
          <h2 className="mt-2 break-words font-display text-3xl font-semibold tracking-tight sm:text-4xl">Track real-world validation evidence for this idea.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">
            Plans are assumptions. Proof comes from real people. Log what happened outside the app so your Next Best Action, confidence, and First Dollar Sprint can update.
          </p>
        </div>
        <Button type="button" onClick={() => { setIsFormOpen(true); void trackEvidenceStart(projectId, "blank"); }} className="gap-2">
          <Plus className="size-4" />
          Add Experiment
        </Button>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="grid gap-5">
          <div className="rounded-[1.75rem] border border-ink/10 bg-gradient-to-br from-lime/35 via-cream to-white p-5">
            <p className="text-xs font-black uppercase tracking-[.16em] text-moss">Validation confidence</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-6xl font-semibold">{summary.confidence_score}</p>
                <p className="text-sm font-black uppercase tracking-[.12em] text-ink/45">/100</p>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-xs font-black uppercase tracking-[.12em]", confidenceClass(summary.confidence_score))}>
                {summary.confidence_label}
              </span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-gradient-to-r from-coral via-gold to-moss transition-all duration-700" style={{ width: `${summary.confidence_score}%` }} />
            </div>
            <p className="mt-4 text-sm leading-6 text-ink/60">{summary.evidence_sentence}</p>
          </div>

          <div className="rounded-[1.75rem] border border-ink/10 bg-ink p-5 text-white">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-gold">
              <Activity className="size-4" />
              Next evidence move
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/75">{summary.recommended_next_action}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <MetricTile label="Experiments" value={summary.experiment_count} />
            <MetricTile label="Contacted" value={summary.people_contacted} />
            <MetricTile label="Replies" value={summary.replies} />
            <MetricTile label="Pain confirmed" value={summary.pain_confirmed} />
            <MetricTile label="Interested" value={summary.interested_users} />
            <MetricTile label="Revenue" value={`$${(summary.preorders_or_revenue_cents / 100).toFixed(0)}`} />
          </div>
        </div>

        <div className="grid gap-5">
          {message && <p role="status" className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{message}</p>}
          {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}

          {isFormOpen && (
            <ExperimentForm
              form={form}
              isEditing={Boolean(editingId)}
              isPending={isPending}
              onCancel={resetForm}
              onSubmit={submitForm}
              onUpdate={updateField}
            />
          )}

          {experiments.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-moss/30 bg-lime/20 p-5">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-moss">
                <ClipboardCheck className="size-4" />
                Starter validation sprint
              </p>
              <h3 className="mt-3 font-display text-2xl font-semibold">You have no real-world proof yet.</h3>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                Start one small validation experiment.
              </p>
              <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-ink/65">
                <p className="font-bold text-ink">Suggested hypothesis</p>
                <p className="mt-1">{starter.hypothesis}</p>
                <p className="mt-3 font-bold text-ink">Task</p>
                <p className="mt-1">{starter.task_description}</p>
              </div>
              <Button type="button" onClick={beginCreateFromStarter} className="mt-5 gap-2">
                <Plus className="size-4" />
                Use Starter Experiment
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-violet/15 bg-violet/10 p-4">
                <p className="text-xs font-black uppercase tracking-[.16em] text-violet">What to improve next</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {missingEvidence.map((gap) => (
                    <span key={gap} className="rounded-full bg-white px-3 py-1 text-xs font-black text-ink/60">{gap}</span>
                  ))}
                </div>
              </div>

              {experiments.map((experiment) => (
                <ExperimentCard
                  key={experiment.id}
                  experiment={experiment}
                  onDelete={() => removeExperiment(experiment.id)}
                  onEdit={() => beginEdit(experiment)}
                  disabled={isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

async function trackEvidenceStart(projectId: string, source: "starter" | "blank") {
  try {
    await fetch("/api/beta-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName: "core_loop_evidence_started", metadata: { project_id: projectId, source } }), keepalive: true });
  } catch {
    // Analytics must never block evidence entry.
  }
}

async function trackEvidenceError(projectId: string, category: "create_failed" | "update_failed") {
  try {
    await fetch("/api/beta-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName: "core_loop_error_viewed", metadata: { project_id: projectId, surface: "proof_board", category } }), keepalive: true });
  } catch {
    // Error diagnostics are best-effort and never replace the user-facing message.
  }
}

function ExperimentForm({
  form,
  isEditing,
  isPending,
  onCancel,
  onSubmit,
  onUpdate,
}: {
  form: FormState;
  isEditing: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  onUpdate: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-ink/10 bg-cream/55 p-5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-violet">{isEditing ? "Edit experiment" : "New experiment"}</p>
          <h3 className="mt-1 font-display text-2xl font-semibold">Track proof from the real world</h3>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Experiment title">
          <Input value={form.title} onChange={(event) => onUpdate("title", event.target.value)} placeholder="10-founder DM validation sprint" />
        </Field>
        <Field label="Channel">
          <Select value={form.channel} onChange={(event) => onUpdate("channel", event.target.value as ValidationChannel)}>
            {validationChannels.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(event) => onUpdate("status", event.target.value as ValidationStatus)}>
            {validationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <Field label="Evidence type">
          <Select value={form.evidence_type} onChange={(event) => onUpdate("evidence_type", event.target.value as FormState["evidence_type"])}>
            {validationEvidenceTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </Select>
        </Field>
        <Field label="Target audience">
          <Input value={form.target_audience} onChange={(event) => onUpdate("target_audience", event.target.value)} placeholder="Busy student founders" />
        </Field>
      </div>

      <div className="mt-4 grid gap-4">
        <Field label="Goal">
          <Textarea value={form.goal} onChange={(event) => onUpdate("goal", event.target.value)} placeholder="What are you trying to learn?" />
        </Field>
        <Field label="Hypothesis">
          <Textarea value={form.hypothesis} onChange={(event) => onUpdate("hypothesis", event.target.value)} placeholder="I believe this audience has this painful problem..." />
        </Field>
        <Field label="Task description">
          <Textarea value={form.task_description} onChange={(event) => onUpdate("task_description", event.target.value)} placeholder="Message 10 people, run a survey, post in a community..." />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="People contacted" value={form.people_contacted} onChange={(value) => onUpdate("people_contacted", value)} />
        <NumberField label="Replies" value={form.replies} onChange={(value) => onUpdate("replies", value)} />
        <NumberField label="Pain confirmed" value={form.pain_confirmed} onChange={(value) => onUpdate("pain_confirmed", value)} />
        <NumberField label="Interested users" value={form.interested_users} onChange={(value) => onUpdate("interested_users", value)} />
        <NumberField label="Waitlist signups" value={form.waitlist_signups} onChange={(value) => onUpdate("waitlist_signups", value)} />
        <NumberField label="Payment intent" value={form.payment_intent} onChange={(value) => onUpdate("payment_intent", value)} />
        <Field label="Revenue / preorders ($)">
          <Input
            min="0"
            step="0.01"
            type="number"
            value={form.revenue_dollars}
            onChange={(event) => onUpdate("revenue_dollars", event.target.value)}
            placeholder="0"
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Key quotes">
          <Textarea value={form.key_quotes} onChange={(event) => onUpdate("key_quotes", event.target.value)} placeholder="Paste what users actually said." />
        </Field>
        <Field label="Learnings">
          <Textarea value={form.learnings} onChange={(event) => onUpdate("learnings", event.target.value)} placeholder="What changed your mind?" />
        </Field>
        <Field label="Next action">
          <Textarea value={form.next_action} onChange={(event) => onUpdate("next_action", event.target.value)} placeholder="What will you do next?" />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="button" onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : isEditing ? "Save Changes" : "Save Experiment"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>Cancel</Button>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <Input min="0" step="1" type="number" value={value} onChange={(event) => onChange(toNonNegativeInteger(event.target.value))} />
    </Field>
  );
}

function ExperimentCard({
  experiment,
  onEdit,
  onDelete,
  disabled,
}: {
  experiment: ProjectValidationExperiment;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const band = confidenceBand(experiment.confidence_score);

  return (
    <article className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cream px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-ink/55">{experiment.status}</span>
            {experiment.channel && <span className="rounded-full bg-violet/10 px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-violet">{experiment.channel}</span>}
            <span className={cn("rounded-full px-3 py-1 text-xs font-black uppercase tracking-[.12em]", confidenceClass(experiment.confidence_score))}>
              {experiment.confidence_score}/100 · {band}
            </span>
          </div>
          <h3 className="mt-3 break-words font-display text-2xl font-semibold">{experiment.title}</h3>
          {experiment.goal && <p className="mt-2 break-words text-sm leading-6 text-ink/60">{experiment.goal}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" onClick={onEdit} disabled={disabled} className="gap-2 px-4">
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button type="button" variant="ghost" onClick={onDelete} disabled={disabled} className="gap-2 px-4 text-red-700 hover:bg-red-50">
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Contacted" value={experiment.people_contacted} />
        <MetricTile label="Replies" value={experiment.replies} />
        <MetricTile label="Pain confirmed" value={experiment.pain_confirmed} />
        <MetricTile label="Interested" value={experiment.interested_users} />
        <MetricTile label="Waitlist" value={experiment.waitlist_signups} />
        <MetricTile label="Payment intent" value={experiment.payment_intent} />
        <MetricTile label="Revenue" value={`$${(experiment.preorders_or_revenue_cents / 100).toFixed(0)}`} />
      </div>

      {(experiment.hypothesis || experiment.task_description || experiment.key_quotes || experiment.learnings || experiment.next_action) && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <TextBlock label="Hypothesis" value={experiment.hypothesis} />
          <TextBlock label="Task" value={experiment.task_description} />
          <TextBlock label="Quotes" value={experiment.key_quotes} />
          <TextBlock label="Learnings" value={experiment.learnings} />
          <TextBlock label="Next action" value={experiment.next_action} wide />
        </div>
      )}
    </article>
  );
}

function MetricTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream/55 p-4">
      <p className="text-xs font-black uppercase tracking-[.13em] text-ink/45">{label}</p>
      <p className="mt-2 flex items-center gap-2 font-display text-2xl font-semibold">
        {label === "Contacted" && <Users className="size-5 text-moss" />}
        {value}
      </p>
    </div>
  );
}

function TextBlock({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={cn("rounded-2xl bg-cream/45 p-4", wide && "lg:col-span-2")}>
      <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{label}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink/65">{value}</p>
    </div>
  );
}

function rowToForm(experiment: ProjectValidationExperiment): FormState {
  return {
    title: experiment.title,
    goal: experiment.goal ?? "",
    status: experiment.status,
    channel: experiment.channel ?? "DMs",
    hypothesis: experiment.hypothesis ?? "",
    target_audience: experiment.target_audience ?? "",
    task_description: experiment.task_description ?? "",
    people_contacted: experiment.people_contacted,
    replies: experiment.replies,
    pain_confirmed: experiment.pain_confirmed,
    interested_users: experiment.interested_users,
    waitlist_signups: experiment.waitlist_signups,
    payment_intent: experiment.payment_intent,
    preorders_or_revenue_cents: experiment.preorders_or_revenue_cents,
    key_quotes: experiment.key_quotes ?? "",
    learnings: experiment.learnings ?? "",
    next_action: experiment.next_action ?? "",
    confidence_score: experiment.confidence_score,
    validation_path_id: experiment.validation_path_id,
    target_assumption_id: experiment.target_assumption_id,
    evidence_type: experiment.evidence_type as FormState["evidence_type"],
    decision_type: experiment.decision_type,
    request_id: experiment.request_id,
    revenue_dollars: centsToDollars(experiment.preorders_or_revenue_cents),
  };
}

function formToPayload(form: FormState): ValidationExperimentInput {
  return {
    title: form.title,
    goal: form.goal,
    status: form.status,
    channel: form.channel,
    hypothesis: form.hypothesis,
    target_audience: form.target_audience,
    task_description: form.task_description,
    people_contacted: form.people_contacted,
    replies: form.replies,
    pain_confirmed: form.pain_confirmed,
    interested_users: form.interested_users,
    waitlist_signups: form.waitlist_signups,
    payment_intent: form.payment_intent,
    preorders_or_revenue_cents: dollarsToCents(form.revenue_dollars),
    key_quotes: form.key_quotes,
    learnings: form.learnings,
    next_action: form.next_action,
    confidence_score: form.confidence_score,
    validation_path_id: form.validation_path_id,
    target_assumption_id: form.target_assumption_id,
    evidence_type: form.evidence_type,
    decision_type: form.decision_type,
    request_id: form.request_id,
  };
}

function nextEvidenceGaps(summary: ReturnType<typeof summarizeProof>) {
  const gaps = [
    summary.people_contacted < 10 ? "Contact 10 people" : "",
    summary.replies < 3 ? "Get 3 replies" : "",
    summary.pain_confirmed < 3 ? "Confirm pain 3 times" : "",
    summary.interested_users < 2 ? "Find 2 interested users" : "",
    summary.waitlist_signups < 1 ? "Collect 1 waitlist signup" : "",
    summary.payment_intent < 1 ? "Ask for payment intent" : "",
  ].filter(Boolean);
  return gaps.length ? gaps.slice(0, 3) : ["Proof looks strong", "Invite testers", "Build the smallest MVP"];
}

function confidenceClass(score: number) {
  if (score <= 20) return "bg-ink/10 text-ink/75";
  if (score <= 45) return "bg-coral/15 text-coral";
  if (score <= 70) return "bg-gold/25 text-amber-700";
  return "bg-lime/35 text-moss";
}

function toNonNegativeInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function dollarsToCents(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function centsToDollars(value: number) {
  return value > 0 ? (value / 100).toFixed(2) : "";
}
