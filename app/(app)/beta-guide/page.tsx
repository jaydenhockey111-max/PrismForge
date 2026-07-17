import { BetaFeedbackButton } from "@/components/beta-feedback-button";
import { BetaHandbook } from "@/components/beta-handbook";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Beta Testing Guide" };

export default function BetaGuidePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <BetaHandbook />
      <div className="mt-7 flex flex-wrap gap-3">
        <ButtonLink href="/generate">Create one project</ButtonLink>
        <ButtonLink href="/projects" variant="secondary">Open projects</ButtonLink>
        <BetaFeedbackButton />
      </div>
    </div>
  );
}
