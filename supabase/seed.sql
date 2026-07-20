-- Seed the first organization (PRD §24). Idempotent.
-- Fixed UUID so profiles can be linked during bootstrap before an admin signs up.
insert into public.organizations (id, name, slug, timezone, locale)
values (
  '11111111-1111-1111-1111-111111111111',
  'GEOID (Thailand) Co., Ltd.',
  'geoid',
  'Asia/Bangkok',
  'th-TH'
)
on conflict (id) do nothing;
