"use client";

import { ExternalLink } from "lucide-react";

export const BETA_FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeUnpg94EOhlTv9HiBHO5cmoSxp3lWU59G504OHv-5DW2nAbw/viewform";

export function BetaFeedbackButton() {
  return (
    <a
      href={BETA_FEEDBACK_FORM_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-violet/20 bg-violet/10 px-4 text-xs font-black text-violet transition duration-200 hover:-translate-y-0.5 hover:border-violet/40 hover:bg-violet hover:text-white hover:shadow-md active:translate-y-0 active:scale-[0.98]"
    >
      &#128172; Beta Feedback
      <ExternalLink className="size-3.5" />
    </a>
  );
}
