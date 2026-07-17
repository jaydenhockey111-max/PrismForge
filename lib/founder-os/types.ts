export type BusinessType =
  | "saas"
  | "ai_tool"
  | "digital_product"
  | "local_service"
  | "content_business"
  | "e_commerce";

export type FounderGoal =
  | "learn"
  | "side_income"
  | "full_time_business"
  | "viral_app"
  | "subscription_saas";

export type ProjectStatus = "idea" | "validating" | "building" | "launched";

export type ScoreKey =
  | "demand"
  | "competition"
  | "monetization"
  | "easeOfMvp"
  | "virality"
  | "founderFit"
  | "recurringRevenue";

export type UserOpportunityInput = {
  interests: string;
  skills: string;
  budget: number;
  timePerWeek: number;
  targetAudience: string;
  businessType: BusinessType;
  goal: FounderGoal;
  riskTolerance: number;
  existingIdea?: string;
};

export type OpportunitySubScore = {
  key: ScoreKey;
  label: string;
  score: number;
  explanation: string;
};

export type OpportunityScore = {
  overall: number;
  demand: number;
  competition: number;
  monetization: number;
  easeOfMvp: number;
  virality: number;
  founderFit: number;
  recurringRevenue: number;
  breakdown: OpportunitySubScore[];
};

export type BusinessIdeaSummary = {
  title: string;
  oneSentenceIdea: string;
  targetCustomer: string;
  painPoint: string;
  whyNow: string;
  whyThisCouldMakeMoney: string;
  businessModel: string;
};

export type MarketValidation = {
  searchDemandAssumptions: string[];
  socialDemandAssumptions: string[];
  competitorLandscape: string;
  existingAlternatives: string[];
  userComplaints: string[];
  underservedAngle: string;
  confidenceNotes: string[];
};

export type Competitor = {
  name: string;
  whatTheyDo: string;
  strength: string;
  weakness: string;
  pricing: string;
  opportunityGap: string;
};

export type MvpPlan = {
  featureList: string[];
  mustHaveFeatures: string[];
  niceToHaveFeatures: string[];
  doNotBuildYet: string[];
  technicalComplexity: "Low" | "Medium" | "High";
  suggestedStack: string[];
  sevenDayBuildPlan: string[];
  thirtyDayLaunchPlan: string[];
};

export type MonetizationPlan = {
  freeTier: string[];
  premiumTier: string[];
  proTier?: string[];
  suggestedPrice: string;
  tierFeatureMap: Array<{ tier: string; price: string; features: string[] }>;
  upsellStrategy: string;
  whyUsersWouldPay: string;
};

export type ContentPlan = {
  shortFormHooks: string[];
  videoScripts: Array<{ title: string; script: string }>;
  tweetIdeas: string[];
  redditAngles: string[];
  seoArticleTitles: string[];
  shockValueAngle: string;
  educationalAngle: string;
  buildingInPublicAngle: string;
};

export type VideoScriptConcept = {
  day: number;
  hook: string;
  bodyScript: string;
  cta: string;
};

export type LandingPageCopy = {
  heroHeadline: string;
  subheadline: string;
  cta: string;
  benefitBullets: string[];
  socialProofPlaceholder: string;
  faq: Array<{ question: string; answer: string }>;
  pricingSectionCopy: string;
};

export type ExecutionRoadmap = {
  today: string[];
  thisWeek: string[];
  thisMonth: string[];
  first100UsersPlan: string[];
  first1000RevenuePlan: string[];
  biggestRisks: string[];
  howToTestQuickly: string[];
};

export type OpportunityReport = {
  generatedAt: string;
  input: UserOpportunityInput;
  score: OpportunityScore;
  summary: BusinessIdeaSummary;
  marketValidation: MarketValidation;
  competitors: Competitor[];
  mvpPlan: MvpPlan;
  monetizationPlan: MonetizationPlan;
  contentPlan: ContentPlan;
  contentScriptBatch?: VideoScriptConcept[];
  landingPageCopy: LandingPageCopy;
  executionRoadmap: ExecutionRoadmap;
  generationMode: "mock" | "openai";
  fallbackReason?: string;
};

export type OpportunityProject = {
  id: string;
  user_id: string;
  title: string;
  business_type: BusinessType;
  target_customer: string;
  score: number;
  status: ProjectStatus;
  report_json: OpportunityReport;
  created_at: string;
  updated_at: string;
};
