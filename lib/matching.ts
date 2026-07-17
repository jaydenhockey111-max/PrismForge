import type { EligibilityRules, FounderBusinessType, FounderProjectStatus, Opportunity, Profile } from "./database.types";
import { getSafeDisplayProjectTitle } from "./founder-os/titleQuality";

export type MatchResult = {
  opportunity: Opportunity;
  score: number;
  matchedRules: string[];
  missedRules: string[];
  project?: FundingProjectSignal | null;
};

type Evaluation = { matches: boolean; label: string; weight: number };
export type FundingProjectSignal = {
  id: string;
  title: string;
  business_type: FounderBusinessType;
  target_customer: string;
  score: number;
  status: FounderProjectStatus;
};

export function scoreOpportunity(profile: Profile, opportunity: Opportunity, projects: FundingProjectSignal[] = []): MatchResult {
  const rules = opportunity.eligibility_rules ?? {};
  const project = bestProjectForFundingProgram(rules, projects);
  const checks = evaluateRules(profile, rules, project);

  if (checks.length === 0) {
    return { opportunity, score: 100, matchedRules: ["Open founder program"], missedRules: [], project };
  }

  const possible = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.filter((check) => check.matches).reduce((sum, check) => sum + check.weight, 0);

  return {
    opportunity,
    score: Math.round((earned / possible) * 100),
    matchedRules: checks.filter((check) => check.matches).map((check) => check.label),
    missedRules: checks.filter((check) => !check.matches).map((check) => check.label),
    project,
  };
}

function evaluateRules(profile: Profile, rules: EligibilityRules, project: FundingProjectSignal | null): Evaluation[] {
  const checks: Evaluation[] = [];
  const normalize = (value: string) => value.trim().toLowerCase();

  if (rules.states?.length) {
    checks.push({ matches: !!profile.state && rules.states.includes(profile.state), label: "Location", weight: 2 });
  }
  if (typeof rules.min_age === "number") {
    checks.push({ matches: profile.age !== null && profile.age >= rules.min_age, label: `Age ${rules.min_age}+`, weight: 2 });
  }
  if (typeof rules.max_age === "number") {
    checks.push({ matches: profile.age !== null && profile.age <= rules.max_age, label: `Age ${rules.max_age} or younger`, weight: 2 });
  }
  if (rules.income_ranges?.length) {
    checks.push({ matches: !!profile.income_range && rules.income_ranges.includes(profile.income_range), label: "Income range", weight: 1 });
  }
  if (rules.student_statuses?.length) {
    checks.push({ matches: !!profile.student_status && rules.student_statuses.includes(profile.student_status), label: "Student status", weight: 2 });
  }
  if (rules.occupations?.length) {
    checks.push({
      matches: !!profile.occupation && rules.occupations.map(normalize).some((item) => normalize(profile.occupation!).includes(item)),
      label: "Occupation",
      weight: 1,
    });
  }
  if (rules.interests?.length) {
    const userInterests = new Set(profile.interests.map(normalize));
    checks.push({ matches: rules.interests.some((interest) => userInterests.has(normalize(interest))), label: "Interests", weight: 1 });
  }
  if (rules.business_types?.length) {
    checks.push({
      matches: !!project && rules.business_types.includes(project.business_type),
      label: project ? `Project type: ${project.business_type.replace(/_/g, " ")}` : "Project type",
      weight: 3,
    });
  }
  if (rules.project_statuses?.length) {
    checks.push({
      matches: !!project && rules.project_statuses.includes(project.status),
      label: project ? `Project stage: ${project.status}` : "Project stage",
      weight: 2,
    });
  }
  if (typeof rules.min_project_score === "number") {
    checks.push({
      matches: !!project && project.score >= rules.min_project_score,
      label: `Project score ${rules.min_project_score}+`,
      weight: 2,
    });
  }
  if (rules.target_keywords?.length) {
    const projectTitle = project ? getSafeDisplayProjectTitle({ title: project.title, business_type: project.business_type, target_customer: project.target_customer }) : "";
    const target = `${projectTitle} ${project?.target_customer ?? ""} ${profile.goals ?? ""} ${profile.interests.join(" ")}`.toLowerCase();
    checks.push({
      matches: rules.target_keywords.some((keyword) => target.includes(normalize(keyword))),
      label: "Founder/project keywords",
      weight: 2,
    });
  }

  return checks;
}

export function rankOpportunities(profile: Profile, opportunities: Opportunity[], projects: FundingProjectSignal[] = []) {
  return opportunities
    .filter((opportunity) => !opportunity.deadline || opportunity.deadline >= new Date().toISOString().slice(0, 10))
    .map((opportunity) => scoreOpportunity(profile, opportunity, projects))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || deadlineValue(a.opportunity.deadline) - deadlineValue(b.opportunity.deadline));
}

function deadlineValue(deadline: string | null) {
  return deadline ? new Date(`${deadline}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
}

function bestProjectForFundingProgram(rules: EligibilityRules, projects: FundingProjectSignal[]) {
  if (!projects.length) return null;
  const normalize = (value: string) => value.trim().toLowerCase();
  return [...projects].sort((a, b) => projectFitScore(b, rules, normalize) - projectFitScore(a, rules, normalize))[0] ?? null;
}

function projectFitScore(project: FundingProjectSignal, rules: EligibilityRules, normalize: (value: string) => string) {
  let score = project.score / 10;
  if (rules.business_types?.includes(project.business_type)) score += 30;
  if (rules.project_statuses?.includes(project.status)) score += 15;
  if (typeof rules.min_project_score === "number" && project.score >= rules.min_project_score) score += 10;
  const safeTitle = getSafeDisplayProjectTitle({ title: project.title, business_type: project.business_type, target_customer: project.target_customer });
  const target = `${safeTitle} ${project.target_customer}`.toLowerCase();
  if (rules.target_keywords?.some((keyword) => target.includes(normalize(keyword)))) score += 15;
  return score;
}
