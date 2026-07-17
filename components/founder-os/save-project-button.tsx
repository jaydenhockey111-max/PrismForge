"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logClientEvent } from "@/components/founder-os/generate-form-persistence";
import { isCreateProjectSubmitDisabled } from "@/lib/founder-os/createProjectButtonState";

const SUBMIT_EVENT = "prismforge:project-submit-clicked";
const VALIDATION_EVENT = "prismforge:project-validation-blocked";

export function SaveProjectButton() {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    if (pending) return;
    const timeout = window.setTimeout(() => setClicked(false), 5_000);
    return () => window.clearTimeout(timeout);
  }, [pending, clicked]);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (form?.dataset.submitting === "true") {
      event.preventDefault();
      logClientEvent("duplicate_submission_blocked", { source: "submit_button" });
      window.dispatchEvent(new CustomEvent(SUBMIT_EVENT, { detail: { duplicate: true } }));
      return;
    }
    if (form && !form.checkValidity()) {
      event.preventDefault();
      setClicked(false);
      const invalid = form.querySelector(":invalid") as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      window.dispatchEvent(new CustomEvent(VALIDATION_EVENT, { detail: { field: invalid?.name ?? "unknown" } }));
      window.setTimeout(() => {
        invalid?.focus();
        form.reportValidity();
      }, 0);
      return;
    }
    setClicked(true);
    window.dispatchEvent(new CustomEvent(SUBMIT_EVENT, { detail: { source: "submit_button" } }));
    logClientEvent("project_creation_client_started", { source: "submit_button" });
    logClientEvent("project_creation_submit_clicked", { source: "submit_button" });
  }

  return (
    <Button type="submit" disabled={isCreateProjectSubmitDisabled({ pending, clicked })} onClick={handleClick} className="w-full gap-2 sm:w-auto" aria-describedby="project-creation-status" aria-busy={pending || clicked}>
      {pending || clicked ? <span className="size-4 animate-spin rounded-full border-2 border-ink border-t-transparent" aria-hidden="true" /> : <Sparkles className="size-4" />}
      {pending ? "Creating Your Project..." : clicked ? "Starting..." : "Create Project"}
    </Button>
  );
}
