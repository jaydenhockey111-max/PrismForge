insert into public.opportunities
  (title, description, deadline, category, eligibility_rules, url, status, estimated_value)
values
  (
    'Garden State Student Founder Fellowship',
    'A founder fellowship for New Jersey student builders working on technology, AI, climate, education, or community-impact startup ideas.',
    (current_date + interval '45 days')::date,
    'founder_fellowship',
    '{"states":["NJ"],"max_age":24,"student_statuses":["high_school","undergraduate"],"interests":["Technology","Science","Business"],"business_types":["ai_tool","saas"],"min_project_score":70}',
    'https://example.org/garden-state-founder-fellowship',
    'published',
    15000
  ),
  (
    'Community Climate Startup Grant',
    'A small startup grant for founders building climate, sustainability, conservation, clean energy, or community resilience products.',
    (current_date + interval '21 days')::date,
    'startup_grant',
    '{"min_age":18,"interests":["Environment","Community Service","Technology"],"target_keywords":["climate","local","energy"],"min_project_score":65}',
    'https://example.org/climate-startup-grant',
    'published',
    10000
  ),
  (
    'Future Builders Accelerator',
    'A summer accelerator for undergraduate and first-time founders building technology, engineering, design, and early-stage startup projects.',
    (current_date + interval '60 days')::date,
    'accelerator',
    '{"student_statuses":["undergraduate"],"interests":["Technology","Engineering","Design","Business"],"business_types":["saas","ai_tool","digital_product"],"project_statuses":["validating","building"]}',
    'https://example.org/future-builders-accelerator',
    'published',
    25000
  ),
  (
    'Small Business Energy Efficiency Rebate',
    'A small business rebate that helps qualifying founders reduce startup costs for insulation, heat pumps, storefront upgrades, and energy-efficiency improvements.',
    null,
    'small_business_rebate',
    '{"states":["NJ","NY","PA"],"income_ranges":["under_25k","25k_50k","50k_100k"],"business_types":["local_service","e_commerce"]}',
    'https://example.org/business-energy-rebate',
    'published',
    1500
  ),
  (
    'National Student Startup Pitch Challenge',
    'A nationwide pitch competition for high-school and undergraduate founders working on original science, technology, or social-impact startup projects.',
    (current_date + interval '90 days')::date,
    'pitch_competition',
    '{"max_age":24,"student_statuses":["high_school","undergraduate"],"interests":["Science","Research","Technology","Business"],"project_statuses":["validating","building","launched"]}',
    'https://example.org/student-startup-pitch-challenge',
    'published',
    5000
  );
