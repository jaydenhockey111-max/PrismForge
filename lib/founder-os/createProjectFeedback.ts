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
