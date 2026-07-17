import { BUSINESS_TYPE_LABELS, compactList, shortProjectName, titleCase } from "@/lib/founder-os/helpers";
import type { BusinessType, OpportunityReport, ProjectStatus, UserOpportunityInput } from "@/lib/founder-os/types";
import type { ProofSummary } from "@/lib/proof-board";

export type ProjectType =
  | "SaaS"
  | "Marketplace"
  | "Mobile App"
  | "Web App"
  | "Physical Product"
  | "Course"
  | "Coaching"
  | "Community"
  | "Content Brand"
  | "Creator Business"
  | "Agency"
  | "Consulting"
  | "Nonprofit"
  | "Education Tool"
  | "Internal Tool"
  | "AI Tool"
  | "Consumer App"
  | "B2B Software"
  | "B2C Product"
  | "Hardware"
  | "Local Business"
  | "General Project";

export type SolutionCategory =
  | "Planning Tool"
  | "Marketplace"
  | "Automation"
  | "Education"
  | "Scheduling"
  | "Finance"
  | "Health"
  | "Fitness"
  | "Travel"
  | "Gaming"
  | "Social"
  | "Productivity"
  | "Analytics"
  | "Communication"
  | "Creator Tools"
  | "Service"
  | "Commerce"
  | "Community"
  | "General Workflow";

export type ProjectContext = {
  title: string;
  concept: string;
  oneSentenceDescription: string;
  audience: string;
  audienceRole: string;
  problem: string;
  desiredOutcome: string;
  businessType: BusinessType;
  businessTypeLabel: string;
  projectType: ProjectType;
  projectTypeConfidence: "high" | "medium" | "low";
  solutionCategory: SolutionCategory;
  solutionCategoryConfidence: "high" | "medium" | "low";
  stage: ProjectStatus;
  founder: {
    interests: string[];
    skills: string[];
    budget: number;
    hoursPerWeek: number;
    riskTolerance: number;
    goal: string;
    technicalAbility: "low" | "medium" | "high";
  };
  constraints: string[];
  assumptions: string[];
  evidence: {
    summary: "No evidence collected yet" | "Some evidence collected" | "Revenue or payment evidence collected";
    peopleContacted: number;
    replies: number;
    painConfirmed: number;
    interestedUsers: number;
    waitlistSignups: number;
    paymentSignals: number;
  };
  language: {
    userNoun: string;
    productNoun: string;
    buildVerb: string;
    validationVerb: string;
    releaseNoun: string;
    firstProofTarget: string;
  };
  recommendedValidation: string[];
  recommendedBlockers: string[];
};

export function createProjectContext({
  report,
  status = "idea",
  proof,
}: {
  report: OpportunityReport;
  status?: ProjectStatus;
  proof?: ProofSummary | null;
}): ProjectContext {
  const input = report.input ?? inferInputFromReport(report);
  const title = shortProjectName(report.summary?.title || input.existingIdea || `${input.businessType} project`);
  const combined = contextText(report);
  const projectTypeResult = inferProjectType({ businessType: input.businessType, text: combined });
  const solutionCategoryResult = inferSolutionCategory(combined);
  const audience = cleanPhrase(report.summary?.targetCustomer || input.targetAudience || "the intended audience");
  const problem = cleanPhrase(report.summary?.painPoint || "the problem to validate");
  const desiredOutcome = inferDesiredOutcome(report);
  const language = contextLanguage(projectTypeResult.type, solutionCategoryResult.category, audience);
  const evidence = evidenceContext(proof);

  return {
    title,
    concept: title,
    oneSentenceDescription: cleanPhrase(report.summary?.oneSentenceIdea || `${title} for ${audience}`),
    audience,
    audienceRole: language.userNoun,
    problem,
    desiredOutcome,
    businessType: input.businessType,
    businessTypeLabel: BUSINESS_TYPE_LABELS[input.businessType] ?? input.businessType,
    projectType: projectTypeResult.type,
    projectTypeConfidence: projectTypeResult.confidence,
    solutionCategory: solutionCategoryResult.category,
    solutionCategoryConfidence: solutionCategoryResult.confidence,
    stage: status,
    founder: founderContext(input),
    constraints: inferConstraints(input),
    assumptions: inferAssumptions(report).slice(0, 6),
    evidence,
    language,
    recommendedValidation: recommendedValidationMethods(projectTypeResult.type, solutionCategoryResult.category, language, audience),
    recommendedBlockers: recommendedBlockers(projectTypeResult.type, solutionCategoryResult.category, language).slice(0, 5),
  };
}

export function buildPromptProjectContext(context: ProjectContext) {
  return {
    project: {
      title: context.title,
      concept: context.concept,
      projectType: context.projectType,
      solutionCategory: context.solutionCategory,
      stage: context.stage,
      audience: context.audience,
      audienceRole: context.audienceRole,
      problem: context.problem,
      desiredOutcome: context.desiredOutcome,
    },
    founder: {
      skills: context.founder.skills.slice(0, 4),
      interests: context.founder.interests.slice(0, 4),
      budget: context.founder.budget,
      hoursPerWeek: context.founder.hoursPerWeek,
      riskTolerance: context.founder.riskTolerance,
      technicalAbility: context.founder.technicalAbility,
    },
    evidence: context.evidence,
    constraints: context.constraints.slice(0, 5),
    assumptions: context.assumptions.slice(0, 5),
    recommendedValidation: context.recommendedValidation.slice(0, 4),
    languageRules: {
      useAudienceWords: context.language.userNoun,
      useReleaseWord: context.language.releaseNoun,
      avoidGenericStartupAdviceUnlessProjectTypeFits: true,
      doNotInventEvidence: true,
    },
  };
}

export function inferProjectType({ businessType, text }: { businessType: BusinessType; text: string }): { type: ProjectType; confidence: "high" | "medium" | "low" } {
  const haystack = text.toLowerCase();
  if (businessType === "local_service" && !/\b(agency|consulting|consultant)\b/.test(haystack)) return { type: "Local Business", confidence: "high" };
  if (/\b(marketplace|two-sided|buyers and sellers|vendors)\b/.test(haystack)) return { type: "Marketplace", confidence: "high" };
  if (/\b(course|lesson|curriculum|cohort|class|workshop)\b/.test(haystack)) return { type: "Course", confidence: "high" };
  if (/\b(community|discord|forum|membership|club)\b/.test(haystack)) return { type: "Community", confidence: "high" };
  if (/\b(agency|done-for-you|client service|service business)\b/.test(haystack)) return { type: "Agency", confidence: "high" };
  if (/\b(consulting|consultant|advisor|audit)\b/.test(haystack)) return { type: "Consulting", confidence: "high" };
  if (/\b(physical|hardware|device|wearable|manufacturing|inventory)\b/.test(haystack)) return { type: "Physical Product", confidence: "high" };
  if (/\b(mobile app|ios|android|app store)\b/.test(haystack)) return { type: "Mobile App", confidence: "high" };
  if (/\b(nonprofit|donation|volunteer|grant-funded)\b/.test(haystack)) return { type: "Nonprofit", confidence: "high" };
  if (/\b(study|student|homework|exam|teacher|classroom|education|school)\b/.test(haystack)) return { type: "Education Tool", confidence: "high" };
  if (/\b(youtube|tiktok|newsletter|creator|content brand|media)\b/.test(haystack)) return { type: "Creator Business", confidence: "high" };

  if (businessType === "ai_tool") return { type: "AI Tool", confidence: "high" };
  if (businessType === "saas") return /\b(company|team|business|b2b|agency|operator)\b/.test(haystack) ? { type: "B2B Software", confidence: "medium" } : { type: "SaaS", confidence: "medium" };
  if (businessType === "local_service") return { type: "Local Business", confidence: "high" };
  if (businessType === "content_business") return { type: "Content Brand", confidence: "medium" };
  if (businessType === "e_commerce") return { type: "B2C Product", confidence: "medium" };
  if (businessType === "digital_product") return { type: "B2C Product", confidence: "medium" };

  return { type: "General Project", confidence: "low" };
}

export function inferSolutionCategory(text: string): { category: SolutionCategory; confidence: "high" | "medium" | "low" } {
  const haystack = text.toLowerCase();
  const rules: Array<[RegExp, SolutionCategory]> = [
    [/\b(study|learn|lesson|course|education|homework|exam)\b/, "Education"],
    [/\b(marketplace|buyers|sellers|vendors)\b/, "Marketplace"],
    [/\b(automate|automation|agent|assistant|ai)\b/, "Automation"],
    [/\b(plan|planner|schedule|routine|roadmap|calendar)\b/, "Planning Tool"],
    [/\b(book|booking|appointment|schedule)\b/, "Scheduling"],
    [/\b(finance|budget|money|tax|invest)\b/, "Finance"],
    [/\b(health|therapy|wellness|medical)\b/, "Health"],
    [/\b(fitness|sports|training|hockey|golf|workout)\b/, "Fitness"],
    [/\b(travel|trip|itinerary)\b/, "Travel"],
    [/\b(game|gaming)\b/, "Gaming"],
    [/\b(social|community|friend|network)\b/, "Social"],
    [/\b(productivity|workflow|task|organize|notes)\b/, "Productivity"],
    [/\b(analytics|dashboard|metrics|insight|tracking)\b/, "Analytics"],
    [/\b(message|email|communication|dm|chat)\b/, "Communication"],
    [/\b(creator|content|youtube|tiktok|newsletter)\b/, "Creator Tools"],
    [/\b(shop|store|ecommerce|commerce|product)\b/, "Commerce"],
  ];
  const match = rules.find(([pattern]) => pattern.test(haystack));
  return match ? { category: match[1], confidence: "high" } : { category: "General Workflow", confidence: "low" };
}

export function isStartupLanguageAppropriate(context: ProjectContext) {
  return ["SaaS", "B2B Software", "AI Tool", "Marketplace", "Web App", "Mobile App", "Agency", "Consulting"].includes(context.projectType);
}

export function validationActionForContext(context: ProjectContext) {
  return context.recommendedValidation[0] ?? `Ask 5 ${context.language.userNoun} about the problem in their own words.`;
}

function contextText(report: OpportunityReport) {
  return [
    report.summary?.title,
    report.summary?.oneSentenceIdea,
    report.summary?.targetCustomer,
    report.summary?.painPoint,
    report.input?.existingIdea,
    report.input?.interests,
    report.input?.skills,
    report.mvpPlan?.mustHaveFeatures?.join(" "),
    report.contentPlan?.shortFormHooks?.join(" "),
  ].filter(Boolean).join(" ");
}

function founderContext(input: UserOpportunityInput): ProjectContext["founder"] {
  const skills = compactList(input.skills);
  const technicalAbility = inferTechnicalAbility(skills, input.businessType);
  return {
    interests: compactList(input.interests),
    skills,
    budget: Number(input.budget) || 0,
    hoursPerWeek: Number(input.timePerWeek) || 0,
    riskTolerance: Number(input.riskTolerance) || 5,
    goal: input.goal,
    technicalAbility,
  };
}

function inferTechnicalAbility(skills: string[], businessType: BusinessType): ProjectContext["founder"]["technicalAbility"] {
  const skillText = skills.join(" ").toLowerCase();
  if (/\b(coding|programming|engineering|developer|typescript|react|python|sql)\b/.test(skillText)) return "high";
  if (businessType === "saas" || businessType === "ai_tool") return "medium";
  return "low";
}

function inferConstraints(input: UserOpportunityInput) {
  const constraints: string[] = [];
  if (input.timePerWeek <= 5) constraints.push(`Limited time: ${input.timePerWeek} hours/week. Keep the next step tiny.`);
  else constraints.push(`Available time: ${input.timePerWeek} hours/week. Use short weekly sprints.`);
  if (input.budget <= 100) constraints.push(`Low starter budget: $${input.budget}. Prefer manual/no-code tests.`);
  else constraints.push(`Starter budget: $${input.budget}. Spend only after validation evidence.`);
  if (input.riskTolerance <= 3) constraints.push("Low risk tolerance. Prefer private tests before public launches.");
  if (input.riskTolerance >= 8) constraints.push("High risk tolerance. Move fast, but keep evidence checkpoints.");
  return constraints;
}

function inferAssumptions(report: OpportunityReport) {
  return [
    report.summary?.painPoint ? `${report.summary.targetCustomer} have this problem: ${report.summary.painPoint}` : null,
    report.marketValidation?.underservedAngle,
    ...(report.marketValidation?.searchDemandAssumptions ?? []),
    ...(report.marketValidation?.socialDemandAssumptions ?? []),
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function evidenceContext(proof?: ProofSummary | null): ProjectContext["evidence"] {
  const paymentSignals = (proof?.payment_intent ?? 0) + (proof?.preorders_or_revenue_cents ?? 0);
  return {
    summary: paymentSignals > 0 ? "Revenue or payment evidence collected" : (proof?.people_contacted ?? 0) > 0 || (proof?.replies ?? 0) > 0 ? "Some evidence collected" : "No evidence collected yet",
    peopleContacted: proof?.people_contacted ?? 0,
    replies: proof?.replies ?? 0,
    painConfirmed: proof?.pain_confirmed ?? 0,
    interestedUsers: proof?.interested_users ?? 0,
    waitlistSignups: proof?.waitlist_signups ?? 0,
    paymentSignals,
  };
}

function contextLanguage(projectType: ProjectType, solutionCategory: SolutionCategory, audience: string): ProjectContext["language"] {
  const userNoun = inferAudienceNoun(audience, projectType);
  if (projectType === "Education Tool" || solutionCategory === "Education") {
    return { userNoun, productNoun: "learning tool", buildVerb: "prototype", validationVerb: "test with learners", releaseNoun: "pilot", firstProofTarget: "student feedback" };
  }
  if (projectType === "Agency" || projectType === "Consulting" || projectType === "Local Business") {
    return { userNoun, productNoun: "service offer", buildVerb: "package", validationVerb: "sell a small pilot", releaseNoun: "first client test", firstProofTarget: "client reply" };
  }
  if (projectType === "Course" || projectType === "Coaching") {
    return { userNoun, productNoun: "learning offer", buildVerb: "outline", validationVerb: "pilot one lesson", releaseNoun: "pilot cohort", firstProofTarget: "pilot signup" };
  }
  if (projectType === "Community") {
    return { userNoun, productNoun: "community", buildVerb: "host", validationVerb: "test engagement", releaseNoun: "private group", firstProofTarget: "repeat participation" };
  }
  if (projectType === "Physical Product" || projectType === "Hardware") {
    return { userNoun, productNoun: "prototype", buildVerb: "mock up", validationVerb: "test with buyers", releaseNoun: "prototype test", firstProofTarget: "preorder intent" };
  }
  if (projectType === "Creator Business" || projectType === "Content Brand") {
    return { userNoun, productNoun: "content system", buildVerb: "publish", validationVerb: "test audience response", releaseNoun: "content experiment", firstProofTarget: "saves, replies, or subscribers" };
  }
  return { userNoun, productNoun: "project", buildVerb: "prototype", validationVerb: "test with real users", releaseNoun: "private alpha", firstProofTarget: "real user response" };
}

function recommendedValidationMethods(projectType: ProjectType, category: SolutionCategory, language: ProjectContext["language"], audience: string) {
  if (projectType === "Education Tool" || category === "Education") return [`Run a 15-minute study workflow test with 3 ${language.userNoun}.`, "Ask what made the task easier, confusing, or still annoying.", "Compare before/after confidence or completion time."];
  if (projectType === "Agency" || projectType === "Consulting" || projectType === "Local Business") return ["Send 10 direct service offers to likely buyers.", "Offer one tiny paid or free pilot package.", "Track replies, objections, and booked calls."];
  if (projectType === "Course" || projectType === "Coaching") return ["Pilot one lesson with 3 learners.", "Ask learners to complete one outcome during the session.", "Collect objections before making the full curriculum."];
  if (projectType === "Community") return ["Invite 10 people into a small group.", "Host one useful discussion or challenge.", "Measure repeat participation after 7 days."];
  if (projectType === "Physical Product" || projectType === "Hardware") return ["Show a mockup before manufacturing anything.", "Ask for preorder intent or deposit comfort.", "Test the riskiest usability assumption."];
  if (projectType === "Creator Business" || projectType === "Content Brand" || category === "Creator Tools") return ["Publish 3 pain-point hooks.", "DM 10 target creators for feedback.", "Track replies, saves, comments, or subscribers."];
  return [`Interview 5 ${audience}.`, "Ask how they solve the problem today.", "Offer a tiny prototype, waitlist, or pilot only after pain is confirmed."];
}

function recommendedBlockers(projectType: ProjectType, category: SolutionCategory, language: ProjectContext["language"]) {
  if (projectType === "Education Tool" || category === "Education") return ["No learner workflow tested yet.", "Study or learning outcome is unclear.", "No feedback from students/teachers yet."];
  if (projectType === "Agency" || projectType === "Consulting" || projectType === "Local Business") return ["Service offer is not packaged clearly.", "No outreach list or first client target yet.", "Pricing or scope is not defined."];
  if (projectType === "Course" || projectType === "Coaching") return ["No pilot lesson tested yet.", "Outcome promise is too broad.", "No learner commitment collected yet."];
  if (projectType === "Community") return ["Community reason-to-return is unclear.", "No first 10 members invited yet.", "No engagement ritual tested yet."];
  if (projectType === "Physical Product" || projectType === "Hardware") return ["Prototype/mockup is not tested yet.", "Manufacturing cost risk is unknown.", "No preorder or buyer intent collected yet."];
  return [`No ${language.firstProofTarget} collected yet.`, "Core workflow is not tested yet.", "First distribution path is unclear."];
}

function inferDesiredOutcome(report: OpportunityReport) {
  return cleanPhrase(report.landingPageCopy?.subheadline || report.summary?.whyThisCouldMakeMoney || report.summary?.oneSentenceIdea || "make the target outcome easier");
}

function inferAudienceNoun(audience: string, projectType: ProjectType) {
  const text = audience.toLowerCase();
  if (/\bstudent|school|homework|exam|learner\b/.test(text) || projectType === "Education Tool") return "students";
  if (/\bteacher|classroom\b/.test(text)) return "teachers";
  if (/\bcreator|youtube|tiktok|newsletter\b/.test(text)) return "creators";
  if (/\bbusiness|client|agency|local\b/.test(text)) return "buyers";
  if (/\bathlete|hockey|sports|fitness|golf\b/.test(text)) return "athletes";
  if (projectType === "Agency" || projectType === "Consulting" || projectType === "Local Business") return "clients";
  if (projectType === "Community") return "members";
  return "users";
}

function cleanPhrase(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function inferInputFromReport(report: OpportunityReport): UserOpportunityInput {
  return {
    interests: report.summary?.oneSentenceIdea ?? report.summary?.title ?? "productivity",
    skills: "research",
    budget: 0,
    timePerWeek: 5,
    targetAudience: report.summary?.targetCustomer ?? "target users",
    businessType: "ai_tool",
    goal: "side_income",
    riskTolerance: 5,
    existingIdea: report.summary?.title,
  };
}

export function synthesizeProjectConcept(input: UserOpportunityInput): { concept: string; oneSentenceDescription: string; confidence: "high" | "medium" | "low"; usedOpenAi: false } {
  const audience = input.targetAudience.trim();
  const interests = compactList(input.interests);
  const idea = input.existingIdea?.trim();
  const primaryInterest = interests[0] ?? "productivity";
  const type = inferProjectType({ businessType: input.businessType, text: `${idea ?? ""} ${audience} ${input.interests}` });
  const category = inferSolutionCategory(`${idea ?? ""} ${audience} ${input.interests}`);

  if (idea && idea.length >= 4) {
    return {
      concept: titleCase(shortProjectName(idea)),
      oneSentenceDescription: `${titleCase(shortProjectName(idea))} for ${audience || "the target audience"} focused on ${primaryInterest}.`,
      confidence: "high",
      usedOpenAi: false,
    };
  }

  if (audience.length >= 4 && primaryInterest.length >= 3) {
    const categoryName = category.category === "General Workflow" ? type.type : category.category;
    const concept = `${titleCase(primaryInterest)} ${categoryName}`.replace(/\bGeneral Project\b/, "Project");
    return {
      concept,
      oneSentenceDescription: `${concept} for ${audience} who need a simpler way to make progress on ${primaryInterest}.`,
      confidence: "medium",
      usedOpenAi: false,
    };
  }

  return {
    concept: "General Project",
    oneSentenceDescription: "A project concept that needs a clearer audience or problem before PrismForge can structure it well.",
    confidence: "low",
    usedOpenAi: false,
  };
}
