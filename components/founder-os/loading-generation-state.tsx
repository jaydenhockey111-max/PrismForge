"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

const steps = [
  "Checking your answers",
  "Choosing the strongest direction",
  "Building your project plan",
  "Saving your workspace",
  "Opening your project",
];

export function LoadingGenerationState() {
  const { pending } = useFormStatus();
  const [clientStarted, setClientStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [isDelayed, setIsDelayed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const active = pending || clientStarted;

  useEffect(() => {
    function onStarted() {
      setClientStarted(true);
      setStep(0);
      setIsDelayed(false);
      setTimedOut(false);
      window.setTimeout(() => document.getElementById("project-creation-status")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
    window.addEventListener("prismforge:project-submit-clicked", onStarted);
    return () => window.removeEventListener("prismforge:project-submit-clicked", onStarted);
  }, []);

  useEffect(() => {
    if (!active) {
      setStep(0);
      setIsDelayed(false);
      setTimedOut(false);
      return;
    }
    const interval = window.setInterval(() => setStep((current) => Math.min(steps.length - 1, current + 1)), 1_100);
    const delay = window.setTimeout(() => setIsDelayed(true), 12_000);
    const timeout = window.setTimeout(() => setTimedOut(true), 55_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(delay);
      window.clearTimeout(timeout);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div id="project-creation-status" className="mt-6 rounded-[1.5rem] border border-violet/20 bg-white p-5 shadow-card animate-reward-pop" role="status" aria-live="polite" aria-atomic="true">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[.16em] text-violet">Creating your project</p>
          <p className="mt-2 font-display text-2xl font-semibold">{steps[step]}</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/55">Creating your project usually takes a few seconds. Keep this tab open.</p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-ink text-gold">
          <div className="size-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-5">
        {steps.map((label, index) => (
          <div key={label} className={`h-2 rounded-full ${index <= step ? "bg-gradient-to-r from-violet to-moss" : "bg-cream"}`} />
        ))}
      </div>
      {isDelayed && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
          This is taking longer than expected, but your request is still processing. PrismForge may be switching to a reliable local version.
        </div>
      )}
      {timedOut && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-900">
          We couldn&apos;t confirm completion yet. Your answers are still saved. If this page does not open a project soon, return to the form and try once more — duplicate protection will reopen an already-created project instead of creating copies.
        </div>
      )}
    </div>
  );
}
