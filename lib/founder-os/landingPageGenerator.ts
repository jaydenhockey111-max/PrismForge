import type { LandingPageCopy, UserOpportunityInput } from "@/lib/founder-os/types";
import { audienceLabel, firstInterest, ideaLabel, productNoun, projectSeed, seededPick } from "@/lib/founder-os/helpers";

export function createLandingPageCopy(input: UserOpportunityInput): LandingPageCopy {
  const audience = audienceLabel(input);
  const interest = firstInterest(input);
  const noun = productNoun(input);
  const idea = ideaLabel(input);
  const seed = projectSeed(input);
  const promise = seededPick(
    [
      "a sharper launch plan",
      "a cleaner path from idea to proof",
      "less guessing and faster validation",
      "one focused next move instead of startup chaos",
    ],
    `${seed}:landing-promise`,
  );

  return {
    heroHeadline: `${idea}: ${promise} for ${audience}.`,
    subheadline: `A focused ${noun} that helps ${audience} validate ${interest}, choose the sharpest offer, and move toward real user proof before building too much.`,
    cta: "Validate my idea",
    benefitBullets: [
      `Find the ${interest} pain worth solving before you waste weeks building`,
      `Get a simple MVP scope, pricing angle, and first outreach path for ${audience}`,
      "Track progress from idea to launch without losing momentum",
    ],
    socialProofPlaceholder: `"This helped me go from vague idea to a testable offer in one afternoon." - Early tester`,
    faq: [
      {
        question: "Does this guarantee my idea will make money?",
        answer: "No. It helps you discover, validate, and organize business ideas so you can test them faster and make better decisions.",
      },
      {
        question: "Can beginners use it?",
        answer: "Yes. The workflow is designed to turn confusing startup advice into clear next steps.",
      },
      {
        question: "What if I already have an idea?",
        answer: "Bring it in. The system scores it, pressure-tests it, and turns it into a lean launch plan.",
      },
    ],
    pricingSectionCopy: "Start free with a basic validation report. Upgrade when you want higher report caps, exports, competitor analysis, and weekly monitoring.",
  };
}
