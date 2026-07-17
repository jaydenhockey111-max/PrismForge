-- QuestMint hidden advantage layer: replace general opportunity categories
-- with founder-focused funding and program categories.

-- Drop old category constraints first. Otherwise existing rows cannot be
-- remapped from legacy categories into the new founder-focused categories.
alter table public.opportunities
drop constraint if exists opportunities_category_check;

alter table public.discovery_candidates
drop constraint if exists discovery_candidates_category_check;

alter table public.xp_events
drop constraint if exists xp_events_category_check;

alter table public.category_mastery
drop constraint if exists category_mastery_category_check;

alter table public.collections
drop constraint if exists collections_category_check;

-- Map existing legacy rows into founder-focused categories instead of deleting
-- live data or breaking foreign keys/user history.
update public.opportunities
set category = case category
  when 'grant' then 'startup_grant'
  when 'scholarship' then 'founder_fellowship'
  when 'competition' then 'pitch_competition'
  when 'internship' then 'founder_fellowship'
  when 'research_program' then 'hackathon'
  when 'tax_credit' then 'small_business_rebate'
  when 'government_rebate' then 'small_business_rebate'
  else category
end
where category in ('scholarship', 'grant', 'tax_credit', 'government_rebate', 'internship', 'research_program', 'competition');

update public.discovery_candidates
set category = case category
  when 'grant' then 'startup_grant'
  when 'scholarship' then 'founder_fellowship'
  when 'competition' then 'pitch_competition'
  when 'internship' then 'founder_fellowship'
  when 'research_program' then 'hackathon'
  when 'tax_credit' then 'small_business_rebate'
  when 'government_rebate' then 'small_business_rebate'
  else category
end
where category in ('scholarship', 'grant', 'tax_credit', 'government_rebate', 'internship', 'research_program', 'competition');

create temp table category_mastery_mapped as
select
  user_id,
  case category
    when 'grant' then 'startup_grant'
    when 'scholarship' then 'founder_fellowship'
    when 'competition' then 'pitch_competition'
    when 'internship' then 'founder_fellowship'
    when 'research_program' then 'hackathon'
    when 'tax_credit' then 'small_business_rebate'
    when 'government_rebate' then 'small_business_rebate'
    else category
  end as category,
  sum(category_xp)::integer as category_xp,
  max(level)::integer as level,
  max(updated_at) as updated_at
from public.category_mastery
group by user_id, 2;

delete from public.category_mastery;
insert into public.category_mastery (user_id, category, category_xp, level, updated_at)
select user_id, category, category_xp, level, updated_at
from category_mastery_mapped;
drop table category_mastery_mapped;

update public.xp_events
set category = case category
  when 'grant' then 'startup_grant'
  when 'scholarship' then 'founder_fellowship'
  when 'competition' then 'pitch_competition'
  when 'internship' then 'founder_fellowship'
  when 'research_program' then 'hackathon'
  when 'tax_credit' then 'small_business_rebate'
  when 'government_rebate' then 'small_business_rebate'
  else category
end
where category in ('scholarship', 'grant', 'tax_credit', 'government_rebate', 'internship', 'research_program', 'competition');

update public.collections
set category = case category
  when 'grant' then 'startup_grant'
  when 'scholarship' then 'founder_fellowship'
  when 'competition' then 'pitch_competition'
  when 'internship' then 'founder_fellowship'
  when 'research_program' then 'hackathon'
  when 'tax_credit' then 'small_business_rebate'
  when 'government_rebate' then 'small_business_rebate'
  else category
end
where category in ('scholarship', 'grant', 'tax_credit', 'government_rebate', 'internship', 'research_program', 'competition');

alter table public.opportunities
add constraint opportunities_category_check
check (category in ('startup_grant', 'pitch_competition', 'accelerator', 'hackathon', 'founder_fellowship', 'small_business_rebate'));

alter table public.discovery_candidates
add constraint discovery_candidates_category_check
check (category is null or category in ('startup_grant', 'pitch_competition', 'accelerator', 'hackathon', 'founder_fellowship', 'small_business_rebate'));

alter table public.xp_events
add constraint xp_events_category_check
check (category is null or category in ('startup_grant', 'pitch_competition', 'accelerator', 'hackathon', 'founder_fellowship', 'small_business_rebate'));

alter table public.category_mastery
add constraint category_mastery_category_check
check (category in ('startup_grant', 'pitch_competition', 'accelerator', 'hackathon', 'founder_fellowship', 'small_business_rebate'));

alter table public.collections
add constraint collections_category_check
check (category in ('startup_grant', 'pitch_competition', 'accelerator', 'hackathon', 'founder_fellowship', 'small_business_rebate'));

update public.opportunities
set estimated_value = case category
  when 'startup_grant' then greatest(estimated_value, 10000)
  when 'pitch_competition' then greatest(estimated_value, 5000)
  when 'accelerator' then greatest(estimated_value, 25000)
  when 'hackathon' then greatest(estimated_value, 2500)
  when 'founder_fellowship' then greatest(estimated_value, 15000)
  when 'small_business_rebate' then greatest(estimated_value, 1500)
  else estimated_value
end;

insert into public.collections (collection_key, category, name, description, target_count, xp_reward, badge_key)
values
  ('startup_grant_stack', 'startup_grant', 'Grant Stack', 'Save or apply to startup grants that could fund your build.', 3, 250, null),
  ('pitch_competition_circuit', 'pitch_competition', 'Pitch Circuit', 'Track founder competitions and prize challenges.', 3, 250, null),
  ('accelerator_pipeline', 'accelerator', 'Accelerator Pipeline', 'Build a shortlist of accelerators worth applying to.', 3, 250, null),
  ('hackathon_sprint', 'hackathon', 'Hackathon Sprint', 'Find hackathons that can create momentum and proof.', 3, 250, null),
  ('founder_fellowship_path', 'founder_fellowship', 'Founder Fellowship Path', 'Track fellowships and programs for early founders.', 3, 250, null),
  ('rebate_runway', 'small_business_rebate', 'Rebate Runway', 'Find rebates, credits, and incentives that reduce startup costs.', 3, 250, null)
on conflict (collection_key) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  target_count = excluded.target_count,
  xp_reward = excluded.xp_reward,
  badge_key = excluded.badge_key;

insert into public.source_registry (name, domain, base_url, source_type, trust_level, auto_publish, active, config)
values
  ('U.S. Small Business Administration', 'sba.gov', 'https://www.sba.gov', 'website', 'official', true, true, '{"categories":["startup_grant","accelerator","small_business_rebate"],"notes":"Official small business grants, assistance, and founder support."}'::jsonb),
  ('Challenge.gov', 'challenge.gov', 'https://www.challenge.gov', 'website', 'official', true, true, '{"categories":["pitch_competition","startup_grant","hackathon"],"notes":"Official U.S. government prize and challenge source."}'::jsonb),
  ('U.S. Department of Energy', 'energy.gov', 'https://www.energy.gov', 'website', 'official', true, true, '{"categories":["small_business_rebate","startup_grant"],"notes":"Official energy rebates, credits, and funding source."}'::jsonb),
  ('ENERGY STAR', 'energystar.gov', 'https://www.energystar.gov', 'website', 'official', true, true, '{"categories":["small_business_rebate"],"notes":"Official energy rebate and tax credit source."}'::jsonb),
  ('National Science Foundation', 'nsf.gov', 'https://www.nsf.gov', 'website', 'official', true, true, '{"categories":["startup_grant","pitch_competition","founder_fellowship"],"notes":"Official NSF innovation and funding programs."}'::jsonb),
  ('NASA', 'nasa.gov', 'https://www.nasa.gov', 'website', 'official', true, true, '{"categories":["hackathon","pitch_competition","founder_fellowship"],"notes":"Official NASA challenges, hackathons, and founder-relevant innovation programs."}'::jsonb),
  ('New Jersey', 'nj.gov', 'https://www.nj.gov', 'website', 'official', true, true, '{"categories":["startup_grant","small_business_rebate","accelerator","pitch_competition"],"states":["NJ"]}'::jsonb),
  ('New York', 'ny.gov', 'https://www.ny.gov', 'website', 'official', true, true, '{"categories":["startup_grant","small_business_rebate","accelerator","pitch_competition"],"states":["NY"]}'::jsonb),
  ('Pennsylvania', 'pa.gov', 'https://www.pa.gov', 'website', 'official', true, true, '{"categories":["startup_grant","small_business_rebate","accelerator","pitch_competition"],"states":["PA"]}'::jsonb),
  ('California', 'ca.gov', 'https://www.ca.gov', 'website', 'official', true, true, '{"categories":["startup_grant","small_business_rebate","accelerator","pitch_competition"],"states":["CA"]}'::jsonb),
  ('Massachusetts', 'mass.gov', 'https://www.mass.gov', 'website', 'official', true, true, '{"categories":["startup_grant","small_business_rebate","accelerator","pitch_competition"],"states":["MA"]}'::jsonb),
  ('Texas', 'texas.gov', 'https://www.texas.gov', 'website', 'official', true, true, '{"categories":["startup_grant","small_business_rebate","accelerator","pitch_competition"],"states":["TX"]}'::jsonb)
on conflict (domain) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  source_type = excluded.source_type,
  trust_level = excluded.trust_level,
  auto_publish = excluded.auto_publish,
  active = excluded.active,
  config = excluded.config,
  updated_at = now();

update public.source_registry
set active = false,
    auto_publish = false,
    updated_at = now()
where domain in ('studentaid.gov', 'careeronestop.org', 'ed.gov', 'usajobs.gov', 'nih.gov', 'orau.org', 'pathwaystoscience.org');
