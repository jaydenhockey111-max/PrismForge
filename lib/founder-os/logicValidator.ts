import { createProjectContext, type ProjectContext } from "@/lib/founder-os/projectContext";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import type { ProofSummary } from "@/lib/proof-board";

export type LogicIssueCode =
  | "startup_template_leakage"
  | "audience_context_mismatch"
  | "project_type_mismatch"
  | "validation_method_mismatch"
  | "unsupported_evidence_language";

export type LogicIssue = {
  code: LogicIssueCode;
  message: string;
  severity: "warning" | "error";
};

const STARTUP_TERMS = /\b(founder|startup|investor|traction|growth loop|customer acquisition|launching startups?|series a|venture|pitch deck)\b/i;
const APP_STORE_TERMS = /\b(app store|ios|android|mobile app store)\b/i;
const PAYMENT_TERMS = /\b(payment processor|stripe|checkout|subscription billing)\b/i;
const MVP_TERMS = /\b(mvp|minimum viable product)\b/i;
const EVIDENCE_CLAIMS = /\b(validated|proven|research shows|customers say|users report|demand is strong|market wants)\b/i;

export function validateProjectLogic({
  report,
  status = "idea",
  proof,
}: {
  report: OpportunityReport;
  status?: ProjectStatus;
  proof?: ProofSummary | null;
}): { context: ProjectContext; issues: LogicIssue[] } {
  const context = createProjectContext({ report, status, proof });
  return {
    context,
    issues: validateTextLogic(JSON.stringify(report), context),
  };
}

export function validateTextLogic(text: string, context: ProjectContext): LogicIssue[] {
  const issues: LogicIssue[] = [];
  const value = String(text ?? "");

  if (!isStartupLanguageAllowed(context) && STARTUP_TERMS.test(value)) {
    issues.push({
      code: "startup_template_leakage",
      severity: "warning",
      message: `${context.projectType} should not receive generic startup/founder language unless it directly fits the project.`,
    });
  }

  if ((context.projectType === "Agency" || context.projectType === "Consulting" || context.projectType === "Local Business") && (APP_STORE_TERMS.test(value) || /\bprototype app\b/i.test(value))) {
    issues.push({
      code: "project_type_mismatch",
      severity: "warning",
      message: `${context.projectType} recommendations should focus on service packaging, outreach, pricing, and first-client proof before app-style build steps.`,
    });
  }

  if ((context.projectType === "Education Tool" || context.solutionCategory === "Education") && /\b(students?|learners?)\b/i.test(context.audienceRole) && /\blaunch startups?|customer acquisition|growth loops?\b/i.test(value)) {
    issues.push({
      code: "audience_context_mismatch",
      severity: "warning",
      message: "Education projects should talk about learners, study habits, lessons, homework, exams, or pilot tests instead of startup launch mechanics.",
    });
  }

  if ((context.projectType === "Physical Product" || context.projectType === "Hardware") && APP_STORE_TERMS.test(value)) {
    issues.push({
      code: "project_type_mismatch",
      severity: "warning",
      message: "Physical product recommendations should not use App Store validation unless the project also has a real mobile app component.",
    });
  }

  if ((context.projectType === "Community" || context.projectType === "Content Brand") && PAYMENT_TERMS.test(value)) {
    issues.push({
      code: "validation_method_mismatch",
      severity: "warning",
      message: `${context.projectType} should validate engagement and repeat participation before payment infrastructure.`,
    });
  }

  if ((context.projectType === "Course" || context.projectType === "Coaching") && MVP_TERMS.test(value)) {
    issues.push({
      code: "validation_method_mismatch",
      severity: "warning",
      message: `${context.projectType} should usually test a pilot lesson/cohort instead of defaulting to MVP language.`,
    });
  }

  if (context.evidence.summary === "No evidence collected yet" && EVIDENCE_CLAIMS.test(value)) {
    issues.push({
      code: "unsupported_evidence_language",
      severity: "warning",
      message: "Do not present validation, demand, quotes, or market proof as fact before evidence is logged.",
    });
  }

  return dedupeIssues(issues);
}

export function isStartupLanguageAllowed(context: ProjectContext) {
  return ["SaaS", "B2B Software", "AI Tool", "Marketplace", "Mobile App", "Web App", "Agency", "Consulting"].includes(context.projectType);
}

function dedupeIssues(issues: LogicIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
