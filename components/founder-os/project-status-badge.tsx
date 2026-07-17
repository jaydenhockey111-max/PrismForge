import type { ProjectStatus } from "@/lib/founder-os/types";
import { PROJECT_STATUS_LABELS } from "@/lib/founder-os/helpers";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const classes: Record<ProjectStatus, string> = {
    idea: "bg-blue-50 text-blue-800",
    validating: "bg-amber-50 text-amber-800",
    building: "bg-violet/10 text-violet",
    launched: "bg-green-50 text-green-800",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes[status]}`}>{PROJECT_STATUS_LABELS[status]}</span>;
}
