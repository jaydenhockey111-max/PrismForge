-- QuestMint quality source registry.
-- Adds curated official/trusted sources and blocks common low-signal scholarship SEO domains.

insert into public.source_registry (name, domain, base_url, source_type, trust_level, auto_publish, active, config)
values
  ('Federal Student Aid', 'studentaid.gov', 'https://studentaid.gov', 'website', 'official', true, true, '{"categories":["scholarship","grant"],"notes":"Official U.S. Department of Education student aid source."}'::jsonb),
  ('CareerOneStop', 'careeronestop.org', 'https://www.careeronestop.org', 'website', 'trusted', true, true, '{"categories":["scholarship","internship"],"notes":"U.S. Department of Labor-sponsored career and scholarship resource."}'::jsonb),
  ('U.S. Department of Education', 'ed.gov', 'https://www.ed.gov', 'website', 'official', true, true, '{"categories":["grant","scholarship"],"notes":"Official education grant and student program source."}'::jsonb),
  ('U.S. Small Business Administration', 'sba.gov', 'https://www.sba.gov', 'website', 'official', true, true, '{"categories":["grant"],"notes":"Official small business grant and assistance source."}'::jsonb),
  ('Internal Revenue Service', 'irs.gov', 'https://www.irs.gov', 'website', 'official', true, true, '{"categories":["tax_credit"],"notes":"Official federal tax credit guidance."}'::jsonb),
  ('U.S. Department of Energy', 'energy.gov', 'https://www.energy.gov', 'website', 'official', true, true, '{"categories":["government_rebate","grant"],"notes":"Official energy rebate and funding source."}'::jsonb),
  ('ENERGY STAR', 'energystar.gov', 'https://www.energystar.gov', 'website', 'official', true, true, '{"categories":["government_rebate","tax_credit"],"notes":"Official energy rebate and tax credit source."}'::jsonb),
  ('DSIRE', 'dsireusa.org', 'https://www.dsireusa.org', 'website', 'trusted', true, true, '{"categories":["government_rebate","tax_credit"],"notes":"Trusted energy incentive database from NC Clean Energy Technology Center."}'::jsonb),
  ('USAJOBS', 'usajobs.gov', 'https://www.usajobs.gov', 'api', 'official', true, true, '{"categories":["internship"],"notes":"Official federal job and Pathways internship source."}'::jsonb),
  ('NASA', 'nasa.gov', 'https://www.nasa.gov', 'website', 'official', true, true, '{"categories":["internship","research_program","competition"],"notes":"Official NASA internships, research programs, and challenges."}'::jsonb),
  ('National Science Foundation', 'nsf.gov', 'https://www.nsf.gov', 'website', 'official', true, true, '{"categories":["grant","research_program"],"notes":"Official NSF funding and student research opportunities."}'::jsonb),
  ('National Institutes of Health', 'nih.gov', 'https://www.nih.gov', 'website', 'official', true, true, '{"categories":["research_program","grant"],"notes":"Official NIH research and training opportunities."}'::jsonb),
  ('Challenge.gov', 'challenge.gov', 'https://www.challenge.gov', 'website', 'official', true, true, '{"categories":["competition"],"notes":"Official U.S. government prize challenge source."}'::jsonb),
  ('ORAU', 'orau.org', 'https://www.orau.org', 'website', 'trusted', true, true, '{"categories":["research_program","internship"],"notes":"Trusted research participation and internship program source."}'::jsonb),
  ('Pathways to Science', 'pathwaystoscience.org', 'https://www.pathwaystoscience.org', 'website', 'trusted', false, true, '{"categories":["research_program","internship"],"notes":"High-quality STEM program index; review before publishing."}'::jsonb),
  ('New Jersey', 'nj.gov', 'https://www.nj.gov', 'website', 'official', true, true, '{"categories":["scholarship","government_rebate","tax_credit","internship"],"states":["NJ"]}'::jsonb),
  ('New York', 'ny.gov', 'https://www.ny.gov', 'website', 'official', true, true, '{"categories":["scholarship","government_rebate","tax_credit","internship"],"states":["NY"]}'::jsonb),
  ('Pennsylvania', 'pa.gov', 'https://www.pa.gov', 'website', 'official', true, true, '{"categories":["scholarship","government_rebate","tax_credit","internship"],"states":["PA"]}'::jsonb),
  ('California', 'ca.gov', 'https://www.ca.gov', 'website', 'official', true, true, '{"categories":["scholarship","government_rebate","tax_credit","internship"],"states":["CA"]}'::jsonb),
  ('Massachusetts', 'mass.gov', 'https://www.mass.gov', 'website', 'official', true, true, '{"categories":["scholarship","government_rebate","tax_credit","internship"],"states":["MA"]}'::jsonb),
  ('Texas', 'texas.gov', 'https://www.texas.gov', 'website', 'official', true, true, '{"categories":["scholarship","government_rebate","tax_credit","internship"],"states":["TX"]}'::jsonb),
  ('Michigan', 'michigan.gov', 'https://www.michigan.gov', 'website', 'official', true, true, '{"categories":["scholarship","government_rebate","tax_credit","internship"],"states":["MI"]}'::jsonb),
  ('Illinois', 'illinois.gov', 'https://www.illinois.gov', 'website', 'official', true, true, '{"categories":["scholarship","government_rebate","tax_credit","internship"],"states":["IL"]}'::jsonb)
on conflict (domain) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  source_type = excluded.source_type,
  trust_level = excluded.trust_level,
  auto_publish = excluded.auto_publish,
  active = excluded.active,
  config = public.source_registry.config || excluded.config,
  updated_at = now();

insert into public.source_registry (name, domain, base_url, source_type, trust_level, auto_publish, active, config)
values
  ('Blocked: Bold.org', 'bold.org', 'https://bold.org', 'website', 'blocked', false, true, '{"reason":"Commercial scholarship marketplace; avoid auto-publishing."}'::jsonb),
  ('Blocked: Niche', 'niche.com', 'https://www.niche.com', 'website', 'blocked', false, true, '{"reason":"Commercial scholarship SEO/marketplace; avoid auto-publishing."}'::jsonb),
  ('Blocked: Fastweb', 'fastweb.com', 'https://www.fastweb.com', 'website', 'blocked', false, true, '{"reason":"Commercial scholarship marketplace; avoid auto-publishing."}'::jsonb),
  ('Blocked: ScholarshipOwl', 'scholarshipowl.com', 'https://scholarshipowl.com', 'website', 'blocked', false, true, '{"reason":"Commercial scholarship marketplace; avoid auto-publishing."}'::jsonb),
  ('Blocked: Unigo', 'unigo.com', 'https://www.unigo.com', 'website', 'blocked', false, true, '{"reason":"Commercial scholarship marketplace; avoid auto-publishing."}'::jsonb)
on conflict (domain) do update set
  name = excluded.name,
  trust_level = 'blocked',
  auto_publish = false,
  active = true,
  config = public.source_registry.config || excluded.config,
  updated_at = now();
