export const PROJECT_CREATION_SLOW_AFTER_MS = 45_000;

export function createProjectCreationProgressMessage(isSlow: boolean) {
  return isSlow
    ? "Still working — this is taking a little longer than usual."
    : "PrismForge received your click. Reviewing your answers and creating the project now...";
}

export function createProjectCreationSuccessMessage(usedFallback: boolean) {
  return usedFallback
    ? "Your project is ready. PrismForge created a reliable starting version so you can keep going normally."
    : "Your project is ready. Start with your Next Move.";
}

export function createProjectValidationMessage(field: string) {
  const labels: Record<string, string> = {
    interests: "Add at least one real interest or area you care about.",
    skills: "Add at least one skill you can use.",
    budget: "Enter a starter budget. Use 0 if you have no budget yet.",
    timePerWeek: "Enter how many hours per week you can work. Minimum is 1.",
    targetAudience: "Describe who this project is for.",
    businessType: "Choose the closest business type.",
    goal: "Choose your goal.",
    riskTolerance: "Choose a risk tolerance from 1 to 10.",
  };
  return labels[field] ?? "Please fix the highlighted field before creating your project.";
}
