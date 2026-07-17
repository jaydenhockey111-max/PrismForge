"use client";

import { useEffect, useMemo, useState } from "react";
import { createProjectValidationMessage } from "@/lib/founder-os/createProjectFeedback";

const STORAGE_KEY = "prismforge_generate_form_draft";
const SUBMIT_EVENT = "prismforge:project-submit-clicked";
const VALIDATION_EVENT = "prismforge:project-validation-blocked";
const SUBMIT_STUCK_TIMEOUT_MS = 90_000;

export function GenerateFormPersistence({ formId }: { formId: string }) {
  const [status, setStatus] = useState<{ type: "info" | "error"; message: string } | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const activeForm = form;
    let stuckTimeout: number | null = null;

    function clearStuckTimeout() {
      if (stuckTimeout) {
        window.clearTimeout(stuckTimeout);
        stuckTimeout = null;
      }
    }

    function armStuckTimeout() {
      clearStuckTimeout();
      stuckTimeout = window.setTimeout(() => {
        activeForm.dataset.submitting = "false";
        setStatus({
          type: "error",
          message: "PrismForge could not confirm the project finished. Your answers are still saved — please try again. Duplicate protection will reopen an already-created project instead of making copies.",
        });
        logClientEvent("project_creation_client_timeout", { source: "generate_form", timeout_ms: SUBMIT_STUCK_TIMEOUT_MS });
      }, SUBMIT_STUCK_TIMEOUT_MS);
    }

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) as Record<string, string> : null;
      if (parsed) {
        for (const [name, value] of Object.entries(parsed)) {
          const field = activeForm.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
          if (field && field.type !== "hidden" && !field.value) field.value = value;
        }
      }
    } catch {
      // Draft restoration is best-effort only.
    }

    let submitted = false;
    let dirty = false;

    function saveDraft() {
      const formData = new FormData(activeForm);
      const draft: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (key === "generationRequestId") continue;
        draft[key] = String(value);
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      dirty = true;
    }

    function onSubmit(event: SubmitEvent) {
      if (activeForm.dataset.submitting === "true") {
        event.preventDefault();
        setStatus({ type: "info", message: "PrismForge already received this click. Keep this tab open while the project finishes." });
        logClientEvent("duplicate_submission_blocked", { surface: "generate_form" });
        return;
      }
      submitted = true;
      activeForm.dataset.submitting = "true";
      saveDraft();
      setStatus({ type: "info", message: "PrismForge received your click. Reviewing your answers and creating the project now..." });
      armStuckTimeout();
      window.dispatchEvent(new CustomEvent(SUBMIT_EVENT));
      logClientEvent("project_creation_client_started", { source: "form_submit" });
      logClientEvent("project_creation_request_sent", { source: "form_submit" });
      logClientEvent("project_creation_submit_clicked", { source: "form_submit" });
      logClientEvent("form_completed", { source: "generate_form" });
    }

    function onInvalid(event: Event) {
      const target = event.target as HTMLElement | null;
      activeForm.dataset.submitting = "false";
      clearStuckTimeout();
      const fieldName = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ? target.name : "unknown";
      setStatus({ type: "error", message: createProjectValidationMessage(fieldName) });
      logClientEvent("project_creation_validation_failed", {
        field_key: fieldName,
      });
      window.setTimeout(() => target?.focus(), 0);
    }

    function onValidationBlocked(event: Event) {
      const field = event instanceof CustomEvent && typeof event.detail?.field === "string" ? event.detail.field : "unknown";
      activeForm.dataset.submitting = "false";
      clearStuckTimeout();
      setStatus({ type: "error", message: createProjectValidationMessage(field) });
    }

    function onBeforeUnload() {
      if (!dirty || submitted) return;
      const payload = JSON.stringify({ eventName: "form_abandoned", metadata: { source: "generate_form" } });
      navigator.sendBeacon?.("/api/beta-events", new Blob([payload], { type: "application/json" }));
    }

    activeForm.addEventListener("input", saveDraft);
    activeForm.addEventListener("change", saveDraft);
    activeForm.addEventListener("submit", onSubmit);
    activeForm.addEventListener("invalid", onInvalid, true);
    window.addEventListener(VALIDATION_EVENT, onValidationBlocked);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearStuckTimeout();
      activeForm.removeEventListener("input", saveDraft);
      activeForm.removeEventListener("change", saveDraft);
      activeForm.removeEventListener("submit", onSubmit);
      activeForm.removeEventListener("invalid", onInvalid, true);
      window.removeEventListener(VALIDATION_EVENT, onValidationBlocked);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [formId]);

  if (!status) return null;
  return (
    <div
      className={status.type === "error"
        ? "mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-900"
        : "mb-5 rounded-2xl border border-violet/20 bg-violet/10 px-4 py-3 text-sm font-semibold leading-6 text-ink"}
      role={status.type === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {status.message}
    </div>
  );
}

export function GenerateFieldSuggestions({
  field,
  category,
  suggestions,
  append = true,
}: {
  field: string;
  category: string;
  suggestions: string[];
  append?: boolean;
}) {
  const visibleSuggestions = suggestions.slice(0, 5);

  useEffect(() => {
    logClientEvent("field_suggestion_viewed", { field_key: field, suggestion_category: category });
  }, [category, field]);

  return (
    <div className="mt-1 flex flex-wrap gap-2" aria-label={`${field} suggestions`}>
      {visibleSuggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => applySuggestion(field, suggestion, append, category)}
          className="rounded-full border border-ink/10 bg-cream/70 px-3 py-1.5 text-xs font-bold text-ink/60 transition hover:-translate-y-0.5 hover:border-moss/25 hover:bg-lime/30 hover:text-ink"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

export function ContextualFieldSuggestions({ field }: { field: "targetAudience" | "existingIdea" }) {
  const [values, setValues] = useState({ interests: "", skills: "", existingIdea: "" });

  useEffect(() => {
    const form = document.getElementById("founder-generate-form") as HTMLFormElement | null;
    if (!form) return;
    const activeForm = form;
    function readValues() {
      setValues({
        interests: fieldValue(activeForm, "interests"),
        skills: fieldValue(activeForm, "skills"),
        existingIdea: fieldValue(activeForm, "existingIdea"),
      });
    }
    readValues();
    activeForm.addEventListener("input", readValues);
    activeForm.addEventListener("change", readValues);
    return () => {
      activeForm.removeEventListener("input", readValues);
      activeForm.removeEventListener("change", readValues);
    };
  }, []);

  const targetSuggestions = useMemo(() => targetAudienceSuggestions(values.interests, values.existingIdea), [values.interests, values.existingIdea]);
  const ideaSuggestions = useMemo(() => ideaStarterSuggestions(values.interests, values.skills), [values.interests, values.skills]);

  if (field === "targetAudience") return <GenerateFieldSuggestions field="targetAudience" category="contextual_target_audience" suggestions={targetSuggestions} />;
  return <GenerateFieldSuggestions field="existingIdea" category="contextual_idea" suggestions={ideaSuggestions} />;
}

export function logClientEvent(eventName: string, metadata: Record<string, string | number | boolean | null> = {}) {
  try {
    void fetch("/api/beta-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, metadata }),
      keepalive: true,
    });
  } catch {
    // Client diagnostics are best-effort only.
  }
}

function applySuggestion(field: string, suggestion: string, append: boolean, category: string) {
  const target = document.querySelector(`[name="${field}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (!target) return;
  const current = target.value.trim();
  if (!current || !append) target.value = suggestion;
  else if (!current.toLowerCase().includes(suggestion.toLowerCase())) target.value = `${current}${current.endsWith(",") ? " " : ", "}${suggestion}`;
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.focus();
  logClientEvent("field_suggestion_clicked", { field_key: field, suggestion_category: category });
}

function fieldValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return field?.value ?? "";
}

function targetAudienceSuggestions(interests: string, idea: string) {
  const text = `${interests} ${idea}`.toLowerCase();
  if (/\bhockey|ice hockey|sports|athlete|training\b/.test(text)) return ["Youth hockey players", "Hockey parents", "Local coaches", "Beginner athletes"];
  if (/\bstudy|student|homework|school|notes|class\b/.test(text)) return ["High school students", "Busy students", "Tutors", "Student clubs"];
  if (/\bcreator|tiktok|youtube|content|newsletter\b/.test(text)) return ["Student creators", "Small YouTubers", "Newsletter writers", "Local creators"];
  if (/\blocal|restaurant|gym|salon|shop\b/.test(text)) return ["Local small businesses", "Restaurant owners", "Gym owners", "Service providers"];
  if (/\bparent|family|kids\b/.test(text)) return ["Busy parents", "Working families", "New parents", "After-school programs"];
  return ["High school athletes", "Local small businesses", "Busy parents", "Student creators"];
}

function ideaStarterSuggestions(interests: string, skills: string) {
  const text = `${interests} ${skills}`.toLowerCase();
  if (/\bwriting|copy|research|content\b/.test(text)) return ["Newsletter research service", "Digital guide for beginners", "Content idea tracker", "Interview summary service"];
  if (/\bcoding|ai|software|automation\b/.test(text)) return ["AI study coach", "Simple workflow automator", "Client intake assistant", "Niche planning dashboard"];
  if (/\bdesign|figma|brand|ui\b/.test(text)) return ["Landing page design kit", "Brand starter pack", "Portfolio review service", "Creator thumbnail system"];
  if (/\bhockey|sports|fitness|training\b/.test(text)) return ["Off-ice training planner", "Practice habit tracker", "Coach feedback hub", "Team schedule assistant"];
  return ["Simple AI assistant", "Weekly accountability planner", "Template plus coaching offer", "Niche resource directory"];
}
