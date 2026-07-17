export type ProjectSection = "today" | "project" | "validate" | "ai-team" | "progress" | "launch";

export const PROJECT_SECTIONS: Array<{ id: ProjectSection; label: string; question: string; description: string }> = [
  { id: "today", label: "Today", question: "What should I do next?", description: "One action" },
  { id: "project", label: "Project", question: "What am I building?", description: "Definition" },
  { id: "validate", label: "Validate", question: "How do I know this works?", description: "Evidence" },
  { id: "ai-team", label: "Specialists", question: "I need focused help.", description: "Generate assets" },
  { id: "progress", label: "Progress", question: "How am I doing?", description: "Proof" },
  { id: "launch", label: "Launch", question: "Am I ready?", description: "Alpha readiness" },
];

export function parseProjectSection(value: string | undefined): ProjectSection {
  if (value === "plan") return "project";
  return PROJECT_SECTIONS.some((section) => section.id === value) ? value as ProjectSection : "today";
}
