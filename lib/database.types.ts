export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  age: number | null;
  state: string | null;
  income_range: string | null;
  student_status: string | null;
  occupation: string | null;
  interests: string[];
  role: "user" | "admin";
  plan: "free" | "premium";
  beta_access_until: string | null;
  lifetime_founder: boolean;
  beta_feedback_completed: boolean;
  beta_feedback_completed_at: string | null;
  stripe_customer_id: string | null;
  alerts_enabled: boolean;
  onboarding_completed: boolean;
  goals: string | null;
  resume_link: string | null;
  education_level: string | null;
  created_at: string;
  updated_at: string;
};

export type EligibilityRules = {
  states?: string[];
  min_age?: number;
  max_age?: number;
  income_ranges?: string[];
  student_statuses?: string[];
  occupations?: string[];
  interests?: string[];
  business_types?: FounderBusinessType[];
  project_statuses?: FounderProjectStatus[];
  target_keywords?: string[];
  min_project_score?: number;
};

export type Opportunity = {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  category: OpportunityCategory;
  eligibility_rules: EligibilityRules;
  url: string;
  status: "draft" | "published" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  source_name: string;
  source_id: string | null;
  source_url: string | null;
  source_updated_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  eligibility_summary: string | null;
  review_status: "approved" | "pending" | "rejected";
  checksum: string | null;
  raw_data: Json | null;
  estimated_value: number;
};

export type FounderBusinessType =
  | "saas"
  | "ai_tool"
  | "digital_product"
  | "local_service"
  | "content_business"
  | "e_commerce";

export type FounderProjectStatus = "idea" | "validating" | "building" | "launched";

export type OpportunityProject = {
  id: string;
  user_id: string;
  title: string;
  business_type: FounderBusinessType;
  target_customer: string;
  score: number;
  status: FounderProjectStatus;
  lifecycle_status: ProjectLifecycleStatus;
  last_meaningful_activity_at: string;
  paused_at: string | null;
  resumed_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  abandoned_at: string | null;
  deleted_at: string | null;
  recovery_expires_at: string | null;
  lifecycle_version: number;
  is_synthetic: boolean;
  learning_excluded_at: string | null;
  learning_exclusion_reason: string | null;
  report_json: Json;
  created_at: string;
  updated_at: string;
};

export type ProjectLifecycleStatus = "active" | "paused" | "completed" | "archived" | "abandoned";
export type FounderProjectFocus = { user_id: string; project_id: string; updated_at: string };
export type ProjectLifecycleEvent = { id: string; project_id: string | null; user_id: string; event_type: "project_created" | "project_focused" | "project_unfocused" | "project_paused" | "project_resumed" | "project_completed" | "project_archived" | "project_abandoned" | "project_restored" | "project_soft_deleted" | "project_permanently_deleted" | "project_stage_changed"; previous_status: string | null; next_status: string | null; reason: string | null; request_id: string; metadata: Json; created_at: string };
export type DeletedProjectTombstone = { project_id: string; user_id: string; permanently_deleted_at: string };

export type ProjectOutputType =
  | "landing_page_copy"
  | "validation_survey"
  | "competitive_battlecard"
  | "pricing_tiers"
  | "video_scripts"
  | "sprint_tasks"
  | "ceo_directive"
  | "marketer_gtm_plan"
  | "designer_wireframe"
  | "engineer_boilerplate";

export type ProjectOutput = {
  id: string;
  project_id: string;
  user_id: string;
  output_type: ProjectOutputType;
  content_json: Json;
  created_at: string;
  updated_at: string;
};

export type ProjectValidationExperiment = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  goal: string | null;
  status: "planned" | "active" | "completed" | "paused";
  channel: "DMs" | "interviews" | "survey" | "landing page" | "TikTok" | "Reddit" | "school" | "email" | "other" | null;
  hypothesis: string | null;
  target_audience: string | null;
  task_description: string | null;
  people_contacted: number;
  replies: number;
  pain_confirmed: number;
  interested_users: number;
  waitlist_signups: number;
  payment_intent: number;
  preorders_or_revenue_cents: number;
  key_quotes: string | null;
  learnings: string | null;
  next_action: string | null;
  confidence_score: number;
  validation_path_id: string | null;
  target_assumption_id: string | null;
  evidence_type: string;
  decision_type: string | null;
  request_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FounderValidationPreferenceRow = { id: string; user_id: string; project_id: string; preference: string; reason: string | null; created_at: string; updated_at: string };
export type ValidationPathRow = { id: string; user_id: string; project_id: string; path_type: string; status: "recommended" | "active" | "completed" | "replaced" | "paused" | "blocked"; source: "system" | "founder"; target_assumption_key: string; target_evidence_type: string; rationale: string; success_condition: string; completion_requirement: string; next_path_hint: string | null; selection_reason: string | null; recommended_at: string; activated_at: string | null; completed_at: string | null; replaced_at: string | null; metadata: Json; created_at: string; updated_at: string };
export type ValidationPathEvent = { id: string; user_id: string; project_id: string; validation_path_id: string | null; event_type: string; previous_path_type: string | null; next_path_type: string | null; reason: string | null; request_id: string; metadata: Json; created_at: string };
export type ProjectAssumption = { id: string; user_id: string; project_id: string; assumption_key: string; statement: string; status: "untested" | "supported" | "contradicted" | "inconclusive"; source: "validation_router" | "founder" | "proof_board"; created_at: string; updated_at: string };
export type ProjectDecision = { id: string; user_id: string; project_id: string; validation_path_id: string | null; assumption_id: string | null; experiment_id: string | null; decision_type: string; rationale: string; previous_assumption: string | null; new_assumption: string | null; evidence_summary: string | null; outcome: string | null; request_id: string; created_at: string };
export type ProjectStageHistory = { id: string; user_id: string; project_id: string; previous_stage: FounderProjectStatus; new_stage: FounderProjectStatus; suggested_stage: FounderProjectStatus; conflict: boolean; reason: string | null; request_id: string; created_at: string };
export type FounderTimelineCategory = "projects" | "validation" | "revenue" | "launch" | "learning" | "decisions" | "milestones";
export type FounderTimelineEvent = {
  id: string; user_id: string; project_id: string | null; event_type: string; category: FounderTimelineCategory;
  headline: string; description: string | null; evidence_level: "none" | "self_reported" | "manual_detailed" | "evidence_supported" | "system_verified";
  visibility: "private"; origin_system: string; source_table: string; source_id: string; dedupe_key: string; request_id: string | null;
  decision_id: string | null; proof_experiment_id: string | null; lifecycle_event_id: string | null; xp_event_id: string | null;
  validation_path_id: string | null; metadata: Json; created_at: string; search_document: unknown;
};
export type FounderTimelineResult = Pick<FounderTimelineEvent, "id" | "user_id" | "project_id" | "event_type" | "category" | "headline" | "description" | "evidence_level" | "origin_system" | "request_id" | "decision_id" | "proof_experiment_id" | "lifecycle_event_id" | "xp_event_id" | "validation_path_id" | "metadata" | "created_at"> & {
  project_title: string | null; decision_type: string | null; previous_assumption: string | null; new_assumption: string | null;
  decision_reason: string | null; decision_evidence: string | null; decision_outcome: string | null; proof_title: string | null;
  proof_learnings: string | null; xp_reason: string | null; awarded_xp: number | null;
};
export type FounderLearningState = { user_id:string; dirty_at:string; calculated_at:string|null; data_through:string|null; calculation_started_at:string|null; calculation_request_id:string|null; calculation_version:number; last_error_category:string|null; updated_at:string };
export type FounderProjectLearningSnapshot = { project_id:string; user_id:string; eligibility_status:"fully_eligible"|"partially_eligible"|"ineligible"; eligibility_reason:string; project_type:string|null; lifecycle_outcome:string|null; stage_reached:string|null; hours_per_week:number|null; budget_amount:number|null; budget_band:string|null; risk_tolerance:number|null; technical_ability:string|null; validation_methods:string[]; evidence_types:string[]; meaningful_decision_count:number; experiment_count:number; customer_conversation_count:number; waitlist_signal_count:number; payment_intent_count:number; revenue_evidence_count:number; time_to_first_evidence_days:number|null; time_in_stages:Json; blocker_categories:string[]; assumption_summary:Json; decision_types:string[]; closure_reflection_ids:string[]; limitations:string[]; source_updated_at:string; calculated_at:string };
export type FounderPatternInsight = { id:string; user_id:string; insight_key:string; category:"validation"|"stage"|"blocker"|"assumption"|"decision"|"constraint"|"project_type"|"outcome"|"lesson"; headline:string; explanation:string; evidence_tier:"early_indication"|"repeated_pattern"|"strong_personal_pattern"; supporting_project_count:number; contradicting_project_count:number; limitations:string[]; dimensions:Json; evidence_fingerprint:string; status:"pending"|"active"|"dismissed"|"corrected"|"superseded"; calculation_request_id:string|null; generated_at:string; data_through:string; search_document:unknown };
export type FounderPatternInsightSource = { id:string; insight_id:string; user_id:string; project_id:string; source_role:"supporting"|"contradicting"; source_kind:"project"|"timeline_event"|"decision"|"experiment"|"reflection"|"assumption"|"validation_path"; source_id:string; timeline_event_id:string|null; decision_id:string|null; experiment_id:string|null; reflection_id:string|null; created_at:string };
export type FounderPatternFeedback = { id:string; insight_id:string; user_id:string; feedback_type:"useful"|"dismiss"|"correct"|"exclude_project"|"incomplete_data"|"circumstances_changed"; reason:string|null; excluded_project_id:string|null; request_id:string; created_at:string };
export type FounderGuidancePreferenceRow = { user_id:string; guidance_mode:"guided"|"balanced"|"autonomous"; explanation_depth:"brief"|"standard"|"detailed"; quest_intensity:"light"|"standard"|"ambitious"; historical_personalization_enabled:boolean; show_historical_reminders:boolean; show_personalization_reasons:boolean; preference_version:number; created_at:string; updated_at:string };
export type FounderIntelligenceProfileRow = { user_id:string; profile_version:number; status:"dirty"|"calculating"|"ready"|"error"; profile_json:Json; learning_version:number; generated_at:string|null; data_through:string|null; dirty_at:string; calculation_started_at:string|null; calculation_request_id:string|null; last_error_category:string|null; created_at:string; updated_at:string };
export type FounderGuidancePreferenceEvent = { id:string; user_id:string; event_type:"preferences_updated"|"personalization_reset"; request_id:string; previous_preferences:Json; next_preferences:Json; created_at:string };
export type CoreValueFeedback = {
  id: string;
  user_id: string;
  project_id: string;
  rating: "yes" | "somewhat" | "no" | null;
  decision_summary: string | null;
  recommendation_more_useful: boolean | null;
  contact_permission: boolean;
  contact_preference: "account_email" | null;
  milestone_category: string | null;
  request_id: string;
  submitted_at: string;
  prompt_dismissed_at: string | null;
  prompt_eligible_after: string | null;
  permission_updated_at: string | null;
};

export type GenerationHistory = {
  id: string;
  user_id: string;
  input_json: Json;
  output_json: Json;
  created_at: string;
};

export type UserXp = {
  user_id: string;
  total_xp: number;
  level: number;
  title: string;
  xp_multiplier_until: string | null;
  streak_freezes: number;
  premium_trial_until: string | null;
  legacy_xp: number;
  created_at: string;
  updated_at: string;
};

export type XpEvent = {
  id: string;
  user_id: string;
  action: string;
  xp_delta: number;
  opportunity_id: string | null;
  category: OpportunityCategory | null;
  idempotency_key: string | null;
  metadata: Json;
  project_id: string | null;
  progression_category: "project_structure" | "quest" | "next_action" | "evidence" | "experiment" | "decision" | "milestone" | "launch" | "revenue" | "learning" | "legacy" | "adjustment";
  base_xp: number;
  verification_multiplier: number;
  awarded_xp: number;
  verification_level: "system_verified" | "evidence_supported" | "manual_detailed" | "self_reported" | "legacy";
  source_type: string;
  source_id: string | null;
  reason: string;
  event_status: "awarded" | "reversed" | "correction" | "legacy" | "rejected";
  reverses_event_id: string | null;
  created_at: string;
};

export type FounderLevelReward = { level: number; reward_key: string; label: string; reward_type: "recognition" | "presentation" | "personalization" | "small_utility"; config: Json; active: boolean; created_at: string };
export type FounderRewardGrant = { id: string; user_id: string; level: number; reward_key: string; granted_at: string; metadata: Json };
export type ProgressionFlag = { id: string; user_id: string; project_id: string | null; reason: string; severity: "notice" | "review" | "high"; metadata: Json; created_at: string; resolved_at: string | null };
export type ProjectClosureReflection = { id: string; user_id: string; project_id: string; outcome: "completed" | "paused" | "archived" | "abandoned"; what_was_learned: string; strongest_evidence: string; biggest_mistake: string | null; closure_reason: string; would_do_differently: string; created_at: string; updated_at: string };

export type Streak = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyQuest = {
  id: string;
  quest_key: string;
  title: string;
  description: string;
  action_type: string;
  target_count: number;
  xp_reward: number;
  config: Json;
  active: boolean;
  created_at: string;
};

export type UserDailyQuest = {
  id: string;
  user_id: string;
  quest_date: string;
  daily_quest_id: string;
  title: string;
  description: string;
  action_type: string;
  progress: number;
  target_count: number;
  xp_reward: number;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type Badge = {
  id: string;
  badge_key: string;
  name: string;
  description: string;
  icon: string;
  unlock_condition: Json;
  active: boolean;
  created_at: string;
};

export type UserBadge = {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
  metadata: Json;
};

export type MysteryReward = {
  id: string;
  reward_key: string;
  name: string;
  description: string;
  weight: number;
  metadata: Json;
  active: boolean;
  created_at: string;
};

export type UserReward = {
  id: string;
  user_id: string;
  mystery_reward_id: string | null;
  reward_key: string;
  name: string;
  description: string;
  trigger: string;
  metadata: Json;
  opened_at: string;
  expires_at: string | null;
  created_at: string;
};

export type CategoryMastery = {
  user_id: string;
  category: OpportunityCategory;
  category_xp: number;
  level: number;
  updated_at: string;
};

export type ProfileCompletion = {
  user_id: string;
  completion_percent: number;
  completed_fields: string[];
  missing_fields: string[];
  awarded_milestones: number[];
  updated_at: string;
};

export type MoneyFoundStats = {
  user_id: string;
  total_potential_value: number;
  total_saved_value: number;
  total_applied_value: number;
  total_won_value: number;
  updated_at: string;
};

export type UserOpportunity = {
  user_id: string;
  opportunity_id: string;
  viewed_at: string | null;
  saved_at: string | null;
  applied_at: string | null;
  won_at: string | null;
  last_action_at: string;
  created_at: string;
  updated_at: string;
};

export type Collection = {
  id: string;
  collection_key: string;
  category: OpportunityCategory;
  name: string;
  description: string;
  target_count: number;
  xp_reward: number;
  badge_key: string | null;
  active: boolean;
  created_at: string;
};

export type UserCollection = {
  user_id: string;
  collection_id: string;
  progress_count: number;
  completed_at: string | null;
  updated_at: string;
};

export type Challenge = {
  id: string;
  challenge_key: string;
  title: string;
  description: string;
  goal_type: string;
  goal_target: number;
  xp_reward: number;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at: string;
};

export type ChallengeMember = {
  challenge_id: string;
  user_id: string;
  joined_at: string;
};

export type ChallengeProgress = {
  challenge_id: string;
  user_id: string;
  progress_count: number;
  score_xp: number;
  completed_at: string | null;
  updated_at: string;
};

export type IngestionRun = {
  id: string;
  source_name: string;
  status: "running" | "succeeded" | "failed";
  started_at: string;
  completed_at: string | null;
  discovered_count: number;
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
  archived_count: number;
  error_count: number;
  error_message: string | null;
  metadata: Json;
};

export type SourceRegistry = {
  id: string; name: string; domain: string; base_url: string;
  source_type: "api" | "rss" | "website" | "search";
  trust_level: "official" | "trusted" | "unverified" | "blocked";
  auto_publish: boolean; active: boolean; config: Json;
  last_crawled_at: string | null; next_crawl_at: string | null;
  crawl_interval_minutes: number; created_at: string; updated_at: string;
};

export type DiscoveryCandidate = {
  id: string; canonical_url: string; domain: string; discovered_by: string;
  search_query: string | null; source_title: string | null; source_snippet: string | null;
  raw_content: string | null; content_hash: string | null; extraction: Json | null;
  category: OpportunityCategory | null; deadline: string | null; confidence: number;
  trust_level: "official" | "trusted" | "unverified" | "blocked";
  status: "discovered" | "published" | "quarantined" | "rejected" | "error";
  status_reason: string | null; opportunity_id: string | null;
  first_seen_at: string; last_seen_at: string; last_extracted_at: string | null;
  created_at: string; updated_at: string;
};

export type OpportunityCategory =
  | "startup_grant"
  | "pitch_competition"
  | "accelerator"
  | "hackathon"
  | "founder_fellowship"
  | "small_business_rebate";

export type Subscription = {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailDeliveryLog = {
  id: string;
  user_id: string | null;
  recipient: string;
  email_type: string;
  status: "queued" | "sent" | "failed";
  provider_id: string | null;
  error_message: string | null;
  metadata: Json;
  created_at: string;
};

export type EmailQueue = {
  id: string;
  user_id: string | null;
  recipient: string;
  subject: string;
  html: string;
  email_type: string;
  idempotency_key: string;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  next_attempt_at: string;
  provider_id: string | null;
  last_error: string | null;
  metadata: Json;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Json;
  created_at: string;
};

export type AccountDeletionRequest = {
  id: string;
  user_id: string;
  status: "requested" | "completed" | "canceled";
  requested_at: string;
  completed_at: string | null;
  metadata: Json;
};

export type AppEvent = {
  id: string;
  user_id: string | null;
  event_name: string;
  metadata: Json;
  created_at: string;
};

export type FeatureUsageEvent = {
  id: string;
  user_id: string | null;
  project_id: string | null;
  feature:
    | "opportunity_report"
    | "ceo_ai"
    | "marketer_ai"
    | "designer_ai"
    | "engineer_ai"
    | "validation_survey"
    | "competitive_battlecard"
    | "pricing_tiers"
    | "video_scripts"
    | "sprint_tasks"
    | "market_pulse_refresh"
    | "founder_brief";
  source: "openai" | "fallback" | "cache" | "blocked";
  model: string | null;
  max_output_tokens: number | null;
  approx_prompt_size: number | null;
  duration_ms: number | null;
  reason: string | null;
  success: boolean;
  error_category: string | null;
  usage_month: string;
  metadata: Json;
  created_at: string;
};

export type RateLimitBucket = {
  key: string;
  count: number;
  window_start: string;
  updated_at: string;
};

export type AiRequest = {
  id: string;
  user_id: string;
  project_id: string | null;
  project_scope: string;
  task_id: string;
  request_id: string;
  idempotency_key_hash: string;
  input_hash: string;
  provider: string;
  model_route: string;
  model_id: string;
  prompt_version: string;
  schema_version: string;
  status: "reserved" | "completed" | "failed" | "cached" | "blocked" | "reconciliation_needed";
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_input_tokens: number | null;
  reserved_cost_usd: number;
  actual_cost_usd: number | null;
  result_json: Json | null;
  provider_request_id: string | null;
  attempt_count: number;
  cache_hit: boolean;
  failure_category: string | null;
  failure_reason: string | null;
  retryable: boolean;
  synthetic: boolean;
  source: string;
  latency_ms: number | null;
  cache_expires_at: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiRuntimeControl = {
  control_key: string;
  enabled: boolean;
  numeric_value: number | null;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & Pick<Profile, "id" | "email">; Update: Partial<Profile>; Relationships: [] };
      opportunities: { Row: Opportunity; Insert: Partial<Opportunity> & Pick<Opportunity, "title" | "description" | "category" | "url" | "status" | "eligibility_rules">; Update: Partial<Opportunity>; Relationships: [] };
      opportunity_projects: { Row: OpportunityProject; Insert: Partial<OpportunityProject> & Pick<OpportunityProject, "user_id" | "title" | "business_type" | "target_customer" | "score" | "report_json">; Update: Partial<OpportunityProject>; Relationships: [] };
      founder_project_focus: { Row: FounderProjectFocus; Insert: Partial<FounderProjectFocus> & Pick<FounderProjectFocus, "user_id" | "project_id">; Update: Partial<FounderProjectFocus>; Relationships: [] };
      project_lifecycle_events: { Row: ProjectLifecycleEvent; Insert: Partial<ProjectLifecycleEvent> & Pick<ProjectLifecycleEvent, "user_id" | "event_type" | "request_id">; Update: never; Relationships: [] };
      deleted_project_tombstones: { Row: DeletedProjectTombstone; Insert: Partial<DeletedProjectTombstone> & Pick<DeletedProjectTombstone, "project_id" | "user_id">; Update: never; Relationships: [] };
      project_outputs: { Row: ProjectOutput; Insert: Partial<ProjectOutput> & Pick<ProjectOutput, "project_id" | "user_id" | "output_type" | "content_json">; Update: Partial<ProjectOutput>; Relationships: [] };
      project_validation_experiments: { Row: ProjectValidationExperiment; Insert: Partial<ProjectValidationExperiment> & Pick<ProjectValidationExperiment, "project_id" | "user_id" | "title">; Update: Partial<ProjectValidationExperiment>; Relationships: [] };
      founder_validation_preferences: { Row: FounderValidationPreferenceRow; Insert: Partial<FounderValidationPreferenceRow> & Pick<FounderValidationPreferenceRow, "user_id" | "project_id" | "preference">; Update: Partial<FounderValidationPreferenceRow>; Relationships: [] };
      validation_paths: { Row: ValidationPathRow; Insert: Partial<ValidationPathRow> & Pick<ValidationPathRow, "user_id" | "project_id" | "path_type" | "target_assumption_key" | "target_evidence_type" | "rationale" | "success_condition" | "completion_requirement">; Update: Partial<ValidationPathRow>; Relationships: [] };
      validation_path_events: { Row: ValidationPathEvent; Insert: Partial<ValidationPathEvent> & Pick<ValidationPathEvent, "user_id" | "project_id" | "event_type" | "request_id">; Update: never; Relationships: [] };
      project_assumptions: { Row: ProjectAssumption; Insert: Partial<ProjectAssumption> & Pick<ProjectAssumption, "user_id" | "project_id" | "assumption_key" | "statement">; Update: Partial<ProjectAssumption>; Relationships: [] };
      project_decisions: { Row: ProjectDecision; Insert: Partial<ProjectDecision> & Pick<ProjectDecision, "user_id" | "project_id" | "decision_type" | "rationale" | "request_id">; Update: never; Relationships: [] };
      project_stage_history: { Row: ProjectStageHistory; Insert: Partial<ProjectStageHistory> & Pick<ProjectStageHistory, "user_id" | "project_id" | "previous_stage" | "new_stage" | "suggested_stage" | "request_id">; Update: never; Relationships: [] };
      founder_timeline_events: { Row: FounderTimelineEvent; Insert: never; Update: never; Relationships: [] };
      founder_learning_state: { Row: FounderLearningState; Insert: Partial<FounderLearningState> & Pick<FounderLearningState,"user_id">; Update: Partial<FounderLearningState>; Relationships: [] };
      founder_project_learning_snapshots: { Row: FounderProjectLearningSnapshot; Insert: Partial<FounderProjectLearningSnapshot> & Pick<FounderProjectLearningSnapshot,"project_id"|"user_id">; Update: Partial<FounderProjectLearningSnapshot>; Relationships: [] };
      founder_pattern_insights: { Row: FounderPatternInsight; Insert: Partial<FounderPatternInsight> & Pick<FounderPatternInsight,"user_id"|"insight_key"|"category"|"headline"|"explanation"|"evidence_tier"|"supporting_project_count"|"evidence_fingerprint"|"data_through">; Update: Partial<FounderPatternInsight>; Relationships: [] };
      founder_pattern_insight_sources: { Row: FounderPatternInsightSource; Insert: Partial<FounderPatternInsightSource> & Pick<FounderPatternInsightSource,"insight_id"|"user_id"|"project_id"|"source_role"|"source_kind"|"source_id">; Update: never; Relationships: [] };
      founder_pattern_feedback: { Row: FounderPatternFeedback; Insert: Partial<FounderPatternFeedback> & Pick<FounderPatternFeedback,"insight_id"|"user_id"|"feedback_type"|"request_id">; Update: never; Relationships: [] };
      founder_guidance_preferences: { Row: FounderGuidancePreferenceRow; Insert: Partial<FounderGuidancePreferenceRow> & Pick<FounderGuidancePreferenceRow,"user_id">; Update: Partial<FounderGuidancePreferenceRow>; Relationships: [] };
      founder_intelligence_profiles: { Row: FounderIntelligenceProfileRow; Insert: Partial<FounderIntelligenceProfileRow> & Pick<FounderIntelligenceProfileRow,"user_id">; Update: Partial<FounderIntelligenceProfileRow>; Relationships: [] };
      founder_guidance_preference_events: { Row: FounderGuidancePreferenceEvent; Insert: Partial<FounderGuidancePreferenceEvent> & Pick<FounderGuidancePreferenceEvent,"user_id"|"event_type"|"request_id">; Update: never; Relationships: [] };
      core_value_feedback: { Row: CoreValueFeedback; Insert: Partial<CoreValueFeedback> & Pick<CoreValueFeedback, "user_id" | "project_id" | "rating" | "request_id">; Update: Partial<CoreValueFeedback>; Relationships: [] };
      generation_history: { Row: GenerationHistory; Insert: Partial<GenerationHistory> & Pick<GenerationHistory, "user_id" | "input_json" | "output_json">; Update: never; Relationships: [] };
      subscriptions: { Row: Subscription; Insert: Partial<Subscription> & Pick<Subscription, "user_id">; Update: Partial<Subscription>; Relationships: [] };
      notification_logs: { Row: { id: string; user_id: string; opportunity_id: string; notification_type: "new_match" | "deadline_reminder"; sent_at: string }; Insert: { user_id: string; opportunity_id: string; notification_type: "new_match" | "deadline_reminder"; id?: string; sent_at?: string }; Update: never; Relationships: [] };
      ingestion_runs: { Row: IngestionRun; Insert: Partial<IngestionRun> & Pick<IngestionRun, "source_name">; Update: Partial<IngestionRun>; Relationships: [] };
      source_registry: { Row: SourceRegistry; Insert: Partial<SourceRegistry> & Pick<SourceRegistry, "name" | "domain" | "base_url" | "source_type">; Update: Partial<SourceRegistry>; Relationships: [] };
      discovery_candidates: { Row: DiscoveryCandidate; Insert: Partial<DiscoveryCandidate> & Pick<DiscoveryCandidate, "canonical_url" | "domain" | "discovered_by">; Update: Partial<DiscoveryCandidate>; Relationships: [] };
      user_levels: { Row: { level: number; threshold_xp: number; title: string; created_at: string }; Insert: { level: number; threshold_xp: number; title: string; created_at?: string }; Update: Partial<{ threshold_xp: number; title: string }>; Relationships: [] };
      user_xp: { Row: UserXp; Insert: Partial<UserXp> & Pick<UserXp, "user_id">; Update: Partial<UserXp>; Relationships: [] };
      xp_events: { Row: XpEvent; Insert: Partial<XpEvent> & Pick<XpEvent, "user_id" | "action">; Update: Partial<XpEvent>; Relationships: [] };
      founder_level_rewards: { Row: FounderLevelReward; Insert: Partial<FounderLevelReward> & Pick<FounderLevelReward, "level" | "reward_key" | "label" | "reward_type">; Update: Partial<FounderLevelReward>; Relationships: [] };
      founder_reward_grants: { Row: FounderRewardGrant; Insert: Partial<FounderRewardGrant> & Pick<FounderRewardGrant, "user_id" | "level" | "reward_key">; Update: never; Relationships: [] };
      progression_flags: { Row: ProgressionFlag; Insert: Partial<ProgressionFlag> & Pick<ProgressionFlag, "user_id" | "reason">; Update: Partial<ProgressionFlag>; Relationships: [] };
      project_closure_reflections: { Row: ProjectClosureReflection; Insert: Partial<ProjectClosureReflection> & Pick<ProjectClosureReflection, "user_id" | "project_id" | "outcome" | "what_was_learned" | "strongest_evidence" | "closure_reason" | "would_do_differently">; Update: Partial<ProjectClosureReflection>; Relationships: [] };
      streaks: { Row: Streak; Insert: Partial<Streak> & Pick<Streak, "user_id">; Update: Partial<Streak>; Relationships: [] };
      daily_quests: { Row: DailyQuest; Insert: Partial<DailyQuest> & Pick<DailyQuest, "quest_key" | "title" | "description" | "action_type" | "target_count">; Update: Partial<DailyQuest>; Relationships: [] };
      user_daily_quests: { Row: UserDailyQuest; Insert: Partial<UserDailyQuest> & Pick<UserDailyQuest, "user_id" | "quest_date" | "daily_quest_id" | "title" | "description" | "action_type" | "target_count" | "expires_at">; Update: Partial<UserDailyQuest>; Relationships: [] };
      badges: { Row: Badge; Insert: Partial<Badge> & Pick<Badge, "badge_key" | "name" | "description" | "icon">; Update: Partial<Badge>; Relationships: [] };
      user_badges: { Row: UserBadge; Insert: Partial<UserBadge> & Pick<UserBadge, "user_id" | "badge_id">; Update: Partial<UserBadge>; Relationships: [] };
      mystery_rewards: { Row: MysteryReward; Insert: Partial<MysteryReward> & Pick<MysteryReward, "reward_key" | "name" | "description">; Update: Partial<MysteryReward>; Relationships: [] };
      user_rewards: { Row: UserReward; Insert: Partial<UserReward> & Pick<UserReward, "user_id" | "reward_key" | "name" | "description" | "trigger">; Update: Partial<UserReward>; Relationships: [] };
      category_mastery: { Row: CategoryMastery; Insert: Partial<CategoryMastery> & Pick<CategoryMastery, "user_id" | "category">; Update: Partial<CategoryMastery>; Relationships: [] };
      profile_completion: { Row: ProfileCompletion; Insert: Partial<ProfileCompletion> & Pick<ProfileCompletion, "user_id">; Update: Partial<ProfileCompletion>; Relationships: [] };
      money_found_stats: { Row: MoneyFoundStats; Insert: Partial<MoneyFoundStats> & Pick<MoneyFoundStats, "user_id">; Update: Partial<MoneyFoundStats>; Relationships: [] };
      user_opportunities: { Row: UserOpportunity; Insert: Partial<UserOpportunity> & Pick<UserOpportunity, "user_id" | "opportunity_id">; Update: Partial<UserOpportunity>; Relationships: [] };
      collections: { Row: Collection; Insert: Partial<Collection> & Pick<Collection, "collection_key" | "category" | "name" | "description">; Update: Partial<Collection>; Relationships: [] };
      user_collections: { Row: UserCollection; Insert: Partial<UserCollection> & Pick<UserCollection, "user_id" | "collection_id">; Update: Partial<UserCollection>; Relationships: [] };
      challenges: { Row: Challenge; Insert: Partial<Challenge> & Pick<Challenge, "challenge_key" | "title" | "description" | "goal_type" | "goal_target">; Update: Partial<Challenge>; Relationships: [] };
      challenge_members: { Row: ChallengeMember; Insert: Partial<ChallengeMember> & Pick<ChallengeMember, "challenge_id" | "user_id">; Update: Partial<ChallengeMember>; Relationships: [] };
      challenge_progress: { Row: ChallengeProgress; Insert: Partial<ChallengeProgress> & Pick<ChallengeProgress, "challenge_id" | "user_id">; Update: Partial<ChallengeProgress>; Relationships: [] };
      email_delivery_logs: { Row: EmailDeliveryLog; Insert: Partial<EmailDeliveryLog> & Pick<EmailDeliveryLog, "recipient" | "email_type" | "status">; Update: Partial<EmailDeliveryLog>; Relationships: [] };
      email_queue: { Row: EmailQueue; Insert: Partial<EmailQueue> & Pick<EmailQueue, "recipient" | "subject" | "html" | "email_type" | "idempotency_key">; Update: Partial<EmailQueue>; Relationships: [] };
      admin_audit_logs: { Row: AdminAuditLog; Insert: Partial<AdminAuditLog> & Pick<AdminAuditLog, "action">; Update: Partial<AdminAuditLog>; Relationships: [] };
      account_deletion_requests: { Row: AccountDeletionRequest; Insert: Partial<AccountDeletionRequest> & Pick<AccountDeletionRequest, "user_id">; Update: Partial<AccountDeletionRequest>; Relationships: [] };
      app_events: { Row: AppEvent; Insert: Partial<AppEvent> & Pick<AppEvent, "event_name">; Update: Partial<AppEvent>; Relationships: [] };
      feature_usage_events: { Row: FeatureUsageEvent; Insert: Partial<FeatureUsageEvent> & Pick<FeatureUsageEvent, "feature" | "source">; Update: never; Relationships: [] };
      rate_limit_buckets: { Row: RateLimitBucket; Insert: Partial<RateLimitBucket> & Pick<RateLimitBucket, "key">; Update: Partial<RateLimitBucket>; Relationships: [] };
      ai_requests: { Row: AiRequest; Insert: never; Update: never; Relationships: [] };
      ai_runtime_controls: { Row: AiRuntimeControl; Insert: never; Update: never; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      check_rate_limit: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      reserve_ai_request: { Args: { p_request: Json }; Returns: Json };
      finalize_ai_request: { Args: { p_request: Json }; Returns: Json };
      record_xp_event: {
        Args: {
          p_user_id: string;
          p_action: string;
          p_xp: number;
          p_opportunity_id?: string | null;
          p_category?: string | null;
          p_idempotency_key?: string | null;
          p_metadata?: Json;
        };
        Returns: Array<{ inserted: boolean; level_before: number; level_after: number; total_xp: number }>;
      };
      record_founder_xp_event: {
        Args: { p_user_id: string; p_project_id: string | null; p_event_type: string; p_verification_level: string; p_source_type: string; p_source_id: string; p_idempotency_key: string; p_reason: string; p_metadata?: Json };
        Returns: Array<{ inserted: boolean; awarded_xp: number; level_before: number; level_after: number; total_xp: number; rejection_reason: string | null }>;
      };
      reverse_founder_xp_event: {
        Args: { p_user_id: string; p_event_id: string; p_reason: string; p_idempotency_key: string };
        Returns: Array<{ inserted: boolean; awarded_xp: number; level_before: number; level_after: number; total_xp: number }>;
      };
      search_founder_timeline: {
        Args: { p_project_id?: string | null; p_category?: string | null; p_query?: string | null; p_before_created_at?: string | null; p_before_id?: string | null; p_limit?: number };
        Returns: FounderTimelineResult[];
      };
      record_founder_pattern_feedback: { Args:{p_insight_id:string;p_feedback_type:string;p_reason:string;p_excluded_project_id:string|null;p_request_id:string};Returns:boolean };
      set_project_learning_inclusion: { Args:{p_project_id:string;p_include:boolean;p_reason:string;p_mark_synthetic:boolean;p_request_id:string};Returns:boolean };
      publish_founder_learning_calculation: { Args:{p_user_id:string;p_request_id:string;p_current_fingerprints:Json;p_data_through:string};Returns:boolean };
      search_founder_patterns: { Args:{p_category?:string|null;p_query?:string|null;p_offset?:number;p_limit?:number};Returns:Array<{id:string;insight_key:string;category:string;headline:string;explanation:string;evidence_tier:string;supporting_project_count:number;contradicting_project_count:number;limitations:string[];dimensions:Json;generated_at:string;data_through:string;total_count:number}> };
      update_founder_guidance_preferences: { Args:{p_guidance_mode:string;p_explanation_depth:string;p_quest_intensity:string;p_historical_personalization_enabled:boolean;p_show_historical_reminders:boolean;p_show_personalization_reasons:boolean;p_request_id:string};Returns:FounderGuidancePreferenceRow };
      reset_founder_personalization: { Args:{p_request_id:string};Returns:boolean };
      create_founder_project_atomic: {
        Args: {
          p_request_id: string;
          p_title: string;
          p_business_type: string;
          p_target_customer: string;
          p_score: number;
          p_report_json: Json;
          p_input_json: Json;
        };
        Returns: string;
      };
      set_current_project_focus: {
        Args: { p_project_id: string; p_request_id: string; p_source?: string };
        Returns: Array<{ project_id: string; previous_project_id: string | null; changed: boolean }>;
      };
      register_project_creation_lifecycle: { Args: { p_project_id: string; p_request_id: string }; Returns: boolean };
      transition_project_lifecycle: {
        Args: { p_project_id: string; p_action: string; p_reason: string; p_request_id: string; p_expected_version: number; p_set_focus?: boolean; p_confirmation?: string | null };
        Returns: Array<{ project_id: string; lifecycle_status: string; lifecycle_version: number; deleted_at: string | null; recovery_expires_at: string | null; changed: boolean }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
