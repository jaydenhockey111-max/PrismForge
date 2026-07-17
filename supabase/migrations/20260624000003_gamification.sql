-- QuestMint gamification, value tracking, and challenge system.

alter table public.profiles
  add column if not exists goals text,
  add column if not exists resume_link text check (resume_link is null or resume_link ~ '^https?://'),
  add column if not exists education_level text;

alter table public.opportunities
  add column if not exists estimated_value numeric(12,2) not null default 0 check (estimated_value >= 0);

update public.opportunities
set estimated_value = case category
  when 'scholarship' then 2500
  when 'grant' then 5000
  when 'tax_credit' then 1200
  when 'government_rebate' then 750
  when 'internship' then 3000
  when 'research_program' then 2000
  when 'competition' then 1000
  else 0
end
where estimated_value = 0;

create table if not exists public.user_levels (
  level integer primary key check (level between 1 and 50),
  threshold_xp integer not null check (threshold_xp >= 0),
  title text not null,
  created_at timestamptz not null default now()
);

insert into public.user_levels (level, threshold_xp, title)
select level,
       ((level - 1) * (level - 1) * 100)::integer,
       case
         when level >= 50 then 'Life Optimization Master'
         when level >= 30 then 'Elite Opportunity Strategist'
         when level >= 20 then 'Grant Hunter'
         when level >= 10 then 'Scholarship Scout'
         when level >= 5 then 'Opportunity Explorer'
         else 'Beginner Hunter'
       end
from generate_series(1, 50) as level
on conflict (level) do update set threshold_xp = excluded.threshold_xp, title = excluded.title;

create table if not exists public.user_xp (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level between 1 and 50),
  title text not null default 'Beginner Hunter',
  xp_multiplier_until timestamptz,
  streak_freezes integer not null default 0 check (streak_freezes >= 0),
  premium_trial_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_xp_set_updated_at before update on public.user_xp
for each row execute function public.set_updated_at();

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  xp_delta integer not null default 0,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  category text check (category is null or category in ('scholarship', 'grant', 'tax_credit', 'government_rebate', 'internship', 'research_program', 'competition')),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists xp_events_user_created_idx on public.xp_events(user_id, created_at desc);
create index if not exists xp_events_action_idx on public.xp_events(action, created_at desc);

create table if not exists public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger streaks_set_updated_at before update on public.streaks
for each row execute function public.set_updated_at();

create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  quest_key text not null unique,
  title text not null,
  description text not null,
  action_type text not null,
  target_count integer not null check (target_count > 0),
  xp_reward integer not null default 100 check (xp_reward >= 0),
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.daily_quests (quest_key, title, description, action_type, target_count, xp_reward, config)
values
  ('save_3', 'Pocket three leads', 'Save 3 promising opportunities for later.', 'opportunity_saved', 3, 100, '{}'),
  ('view_5', 'Scout the board', 'View 5 opportunity pages and learn what fits.', 'opportunity_viewed', 5, 100, '{}'),
  ('apply_1', 'Make one real move', 'Mark 1 opportunity as applied after you submit it.', 'opportunity_applied', 1, 150, '{}'),
  ('profile_1', 'Sharpen your profile', 'Update your profile so matching gets smarter.', 'profile_updated', 1, 100, '{}'),
  ('deadline_1', 'Deadline radar', 'Open 1 opportunity with a real deadline.', 'opportunity_viewed', 1, 75, '{"requires_deadline": true}'),
  ('invite_1', 'Bring a hunter', 'Invite 1 friend to start looking for opportunities.', 'friend_invited', 1, 150, '{}')
on conflict (quest_key) do update set
  title = excluded.title,
  description = excluded.description,
  action_type = excluded.action_type,
  target_count = excluded.target_count,
  xp_reward = excluded.xp_reward,
  config = excluded.config,
  active = true;

create table if not exists public.user_daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_date date not null,
  daily_quest_id uuid not null references public.daily_quests(id) on delete cascade,
  title text not null,
  description text not null,
  action_type text not null,
  progress integer not null default 0 check (progress >= 0),
  target_count integer not null check (target_count > 0),
  xp_reward integer not null default 100 check (xp_reward >= 0),
  completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, quest_date, daily_quest_id)
);

create trigger user_daily_quests_set_updated_at before update on public.user_daily_quests
for each row execute function public.set_updated_at();
create index if not exists user_daily_quests_user_date_idx on public.user_daily_quests(user_id, quest_date desc);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  badge_key text not null unique,
  name text not null,
  description text not null,
  icon text not null,
  unlock_condition jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.badges (badge_key, name, description, icon, unlock_condition)
values
  ('first_match', 'First Match Found', 'You saw your first recommended opportunity.', 'Sparkles', '{"action":"opportunity_viewed","count":1}'),
  ('first_saved', 'First Saved Opportunity', 'You saved your first opportunity.', 'Bookmark', '{"action":"opportunity_saved","count":1}'),
  ('first_application', 'First Application', 'You marked your first opportunity as applied.', 'Send', '{"action":"opportunity_applied","count":1}'),
  ('first_win', 'First Win', 'You marked an opportunity as won.', 'Trophy', '{"action":"opportunity_won","count":1}'),
  ('streak_7', '7-Day Streak', 'You kept the hunt alive for 7 days.', 'Flame', '{"streak":7}'),
  ('streak_30', '30-Day Streak', 'Thirty days of steady opportunity hunting.', 'Flame', '{"streak":30}'),
  ('viewed_10', '10 Opportunities Viewed', 'You reviewed 10 opportunities.', 'Eye', '{"action":"opportunity_viewed","count":10}'),
  ('saved_25', '25 Opportunities Saved', 'You saved 25 opportunities.', 'BookmarkCheck', '{"action":"opportunity_saved","count":25}'),
  ('applied_10', '10 Applications Submitted', 'You marked 10 opportunities as applied.', 'ClipboardCheck', '{"action":"opportunity_applied","count":10}'),
  ('scholarship_hunter', 'Scholarship Hunter', 'You reached Scholarship Mastery level 3.', 'GraduationCap', '{"category":"scholarship","level":3}'),
  ('grant_hunter', 'Grant Hunter', 'You reached Grant Mastery level 3.', 'BadgeDollarSign', '{"category":"grant","level":3}'),
  ('internship_pro', 'Internship Pro', 'You reached Internship Mastery level 3.', 'BriefcaseBusiness', '{"category":"internship","level":3}'),
  ('rebate_collector', 'Rebate Collector', 'You reached Rebate Mastery level 3.', 'ReceiptText', '{"category":"government_rebate","level":3}')
on conflict (badge_key) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  unlock_condition = excluded.unlock_condition,
  active = true;

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, badge_id)
);

create table if not exists public.mystery_rewards (
  id uuid primary key default gen_random_uuid(),
  reward_key text not null unique,
  name text not null,
  description text not null,
  weight integer not null default 1 check (weight > 0),
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.mystery_rewards (reward_key, name, description, weight, metadata)
values
  ('double_xp_24h', 'Double XP for 24 hours', 'Your XP rewards are doubled for the next day.', 25, '{"duration_hours":24}'),
  ('cosmetic_badge', 'Cosmetic badge', 'A rare profile flair for your trophy shelf.', 20, '{"flair":"Star Finder"}'),
  ('premium_trial_3d', 'Premium trial for 3 days', 'Try unlimited matches and alerts for three days.', 10, '{"duration_days":3}'),
  ('bonus_theme', 'Bonus profile theme', 'Unlock the Aurora profile theme.', 15, '{"theme":"Aurora"}'),
  ('hidden_tag', 'Hidden opportunity tag', 'Highlight hidden-gem opportunities in your dashboard.', 15, '{"tag":"hidden-gem"}'),
  ('streak_freeze', 'Streak freeze', 'Protect your streak once if you miss a day.', 15, '{"freezes":1}')
on conflict (reward_key) do update set
  name = excluded.name,
  description = excluded.description,
  weight = excluded.weight,
  metadata = excluded.metadata,
  active = true;

create table if not exists public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mystery_reward_id uuid references public.mystery_rewards(id) on delete set null,
  reward_key text not null,
  name text not null,
  description text not null,
  trigger text not null,
  metadata jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_rewards_user_created_idx on public.user_rewards(user_id, created_at desc);

create table if not exists public.category_mastery (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('scholarship', 'grant', 'tax_credit', 'government_rebate', 'internship', 'research_program', 'competition')),
  category_xp integer not null default 0 check (category_xp >= 0),
  level integer not null default 1 check (level >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table if not exists public.profile_completion (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  completed_fields text[] not null default '{}',
  missing_fields text[] not null default '{}',
  awarded_milestones integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.money_found_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_potential_value numeric(12,2) not null default 0 check (total_potential_value >= 0),
  total_saved_value numeric(12,2) not null default 0 check (total_saved_value >= 0),
  total_applied_value numeric(12,2) not null default 0 check (total_applied_value >= 0),
  total_won_value numeric(12,2) not null default 0 check (total_won_value >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_opportunities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  viewed_at timestamptz,
  saved_at timestamptz,
  applied_at timestamptz,
  won_at timestamptz,
  last_action_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create trigger user_opportunities_set_updated_at before update on public.user_opportunities
for each row execute function public.set_updated_at();
create index if not exists user_opportunities_user_action_idx on public.user_opportunities(user_id, last_action_at desc);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  collection_key text not null unique,
  category text not null check (category in ('scholarship', 'grant', 'tax_credit', 'government_rebate', 'internship', 'research_program', 'competition')),
  name text not null,
  description text not null,
  target_count integer not null default 10 check (target_count > 0),
  xp_reward integer not null default 250 check (xp_reward >= 0),
  badge_key text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.collections (collection_key, category, name, description, target_count, xp_reward, badge_key)
values
  ('scholarships', 'scholarship', 'Scholarships Collection', 'View, save, or apply to 10 scholarship opportunities.', 10, 250, 'scholarship_hunter'),
  ('grants', 'grant', 'Grants Collection', 'View, save, or apply to 10 grant opportunities.', 10, 250, 'grant_hunter'),
  ('tax_credits', 'tax_credit', 'Tax Credits Collection', 'Unlock 10 tax-credit opportunities.', 10, 250, null),
  ('internships', 'internship', 'Internships Collection', 'Unlock 10 internship opportunities.', 10, 250, 'internship_pro'),
  ('rebates', 'government_rebate', 'Rebates Collection', 'Unlock 10 rebate opportunities.', 10, 250, 'rebate_collector')
on conflict (collection_key) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  target_count = excluded.target_count,
  xp_reward = excluded.xp_reward,
  badge_key = excluded.badge_key,
  active = true;

create table if not exists public.user_collections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  progress_count integer not null default 0 check (progress_count >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection_id)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_key text not null unique,
  title text not null,
  description text not null,
  goal_type text not null,
  goal_target integer not null check (goal_target > 0),
  xp_reward integer not null default 300 check (xp_reward >= 0),
  start_date date not null default current_date,
  end_date date not null default (current_date + 7),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.challenges (challenge_key, title, description, goal_type, goal_target, xp_reward)
values
  ('scholarship_7_day', '7-Day Scholarship Challenge', 'Build scholarship momentum for one week.', 'scholarship_actions', 7, 300),
  ('internship_5_apply', 'Apply to 5 Internships Challenge', 'Turn internship hunting into a sprint.', 'internship_applications', 5, 500),
  ('money_10000', 'Find $10,000 in Opportunities Challenge', 'Save or apply to enough opportunities to uncover $10,000 in value.', 'money_found', 10000, 600)
on conflict (challenge_key) do update set
  title = excluded.title,
  description = excluded.description,
  goal_type = excluded.goal_type,
  goal_target = excluded.goal_target,
  xp_reward = excluded.xp_reward,
  active = true;

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table if not exists public.challenge_progress (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress_count integer not null default 0 check (progress_count >= 0),
  score_xp integer not null default 0 check (score_xp >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

-- RLS
alter table public.user_levels enable row level security;
alter table public.user_xp enable row level security;
alter table public.xp_events enable row level security;
alter table public.streaks enable row level security;
alter table public.daily_quests enable row level security;
alter table public.user_daily_quests enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.mystery_rewards enable row level security;
alter table public.user_rewards enable row level security;
alter table public.category_mastery enable row level security;
alter table public.profile_completion enable row level security;
alter table public.money_found_stats enable row level security;
alter table public.user_opportunities enable row level security;
alter table public.collections enable row level security;
alter table public.user_collections enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenge_progress enable row level security;

drop policy if exists "Authenticated users can read user levels" on public.user_levels;
create policy "Authenticated users can read user levels" on public.user_levels for select to authenticated using (true);

drop policy if exists "Users can read their xp" on public.user_xp;
create policy "Users can read their xp" on public.user_xp for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can read their xp history" on public.xp_events;
create policy "Users can read their xp history" on public.xp_events for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can read their streaks" on public.streaks;
create policy "Users can read their streaks" on public.streaks for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read quest templates" on public.daily_quests;
create policy "Authenticated users can read quest templates" on public.daily_quests for select to authenticated using (active = true or public.is_admin());

drop policy if exists "Users can read their daily quests" on public.user_daily_quests;
create policy "Users can read their daily quests" on public.user_daily_quests for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read badges" on public.badges;
create policy "Authenticated users can read badges" on public.badges for select to authenticated using (active = true or public.is_admin());

drop policy if exists "Users can read their badges" on public.user_badges;
create policy "Users can read their badges" on public.user_badges for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read reward templates" on public.mystery_rewards;
create policy "Authenticated users can read reward templates" on public.mystery_rewards for select to authenticated using (active = true or public.is_admin());

drop policy if exists "Users can read their rewards" on public.user_rewards;
create policy "Users can read their rewards" on public.user_rewards for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can read their category mastery" on public.category_mastery;
create policy "Users can read their category mastery" on public.category_mastery for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can read their profile completion" on public.profile_completion;
create policy "Users can read their profile completion" on public.profile_completion for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can read their money stats" on public.money_found_stats;
create policy "Users can read their money stats" on public.money_found_stats for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can read their opportunity progress" on public.user_opportunities;
create policy "Users can read their opportunity progress" on public.user_opportunities for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read collections" on public.collections;
create policy "Authenticated users can read collections" on public.collections for select to authenticated using (active = true or public.is_admin());

drop policy if exists "Users can read their collections" on public.user_collections;
create policy "Users can read their collections" on public.user_collections for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read active challenges" on public.challenges;
create policy "Authenticated users can read active challenges" on public.challenges for select to authenticated using (active = true or public.is_admin());

drop policy if exists "Authenticated users can read challenge members" on public.challenge_members;
create policy "Authenticated users can read challenge members" on public.challenge_members for select to authenticated using (true);

drop policy if exists "Authenticated users can read challenge progress" on public.challenge_progress;
create policy "Authenticated users can read challenge progress" on public.challenge_progress for select to authenticated using (true);

drop policy if exists "Users can join challenges" on public.challenge_members;
create policy "Users can join challenges" on public.challenge_members for insert to authenticated with check (user_id = auth.uid());

-- Writes to most gamification tables are service-role only through server actions.
grant update (name, age, state, income_range, student_status, occupation, interests, alerts_enabled, onboarding_completed, goals, resume_link, education_level)
on public.profiles to authenticated;
