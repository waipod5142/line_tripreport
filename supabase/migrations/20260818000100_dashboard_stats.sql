-- ─────────────────────────────────────────────────────────────
-- 0013 · Dashboard aggregates
--
-- supabase-js can't express GROUP BY, and counting 1,700+ (and growing) rows in
-- Node would get worse every week, so the /dashboard aggregation lives here.
--
-- SECURITY — read before editing:
--   PostgREST automatically exposes every view in `public`, and a Postgres view
--   runs with its OWNER's rights by default. Without `security_invoker = true`
--   these views would hand every organization's counts to any signed-in user,
--   straight past RLS. The flag makes them execute as the caller, so the
--   existing policies on line_messages / line_groups apply unchanged.
--   Requires PG15+; this project is on 17.6.
--
--   Same reasoning for the function: it is SECURITY INVOKER (the default).
--   Do NOT add SECURITY DEFINER to any of these.
-- ─────────────────────────────────────────────────────────────

-- ── Per-group rollup ─────────────────────────────────────────
-- "Today" is a Bangkok calendar day, not a UTC one, so the number matches the
-- timestamps the UI prints. Groups with no messages yet still appear (left
-- join), reporting zeroes rather than vanishing from the dashboard.
create or replace view public.group_message_stats
with (security_invoker = true) as
select
  g.id                                              as line_group_id,
  g.organization_id,
  g.group_name,
  g.status,
  count(m.id)                                       as total,
  count(m.id) filter (
    where (m.sent_at at time zone 'Asia/Bangkok')::date
        = (now() at time zone 'Asia/Bangkok')::date
  )                                                 as today,
  count(m.id) filter (where m.sent_at >= now() - interval '7 days')  as last_7d,
  count(m.id) filter (
    where m.sent_at >= now() - interval '14 days'
      and m.sent_at <  now() - interval '7 days'
  )                                                 as prior_7d,
  count(distinct m.line_member_id) filter (
    where m.sent_at >= now() - interval '7 days'
  )                                                 as senders_7d,
  count(distinct m.line_member_id) filter (
    where (m.sent_at at time zone 'Asia/Bangkok')::date
        = (now() at time zone 'Asia/Bangkok')::date
  )                                                 as senders_today,
  count(m.id) filter (where m.message_type = 'text')  as texts,
  count(m.id) filter (where m.message_type = 'image') as images,
  count(m.id) filter (
    where m.message_type = 'image'
      and (m.sent_at at time zone 'Asia/Bangkok')::date
        = (now() at time zone 'Asia/Bangkok')::date
  )                                                 as images_today,
  min(m.sent_at)                                    as first_message_at,
  max(m.sent_at)                                    as last_message_at
from public.line_groups g
left join public.line_messages m on m.line_group_id = g.id
group by g.id, g.organization_id, g.group_name, g.status;

comment on view public.group_message_stats is
  'Per-group message rollup for /dashboard. security_invoker — RLS applies.';

-- ── Daily series, last 30 days ───────────────────────────────
create or replace view public.group_daily_counts
with (security_invoker = true) as
select
  m.line_group_id,
  (m.sent_at at time zone 'Asia/Bangkok')::date as day,
  count(*)                                      as n
from public.line_messages m
where m.sent_at >= now() - interval '30 days'
group by m.line_group_id, 2;

comment on view public.group_daily_counts is
  'Bangkok-day message counts per group, last 30 days. security_invoker — RLS applies.';

-- ── Keyword counters ─────────────────────────────────────────
-- The vocabulary lives in lib/messages/keywords.ts and is passed in, so adding
-- a phrase never needs a migration. Matching is on short stems because the
-- source chat contains misspellings ("แจ้งทะบียนรับงาน" etc.) that a full-phrase
-- match silently misses.
--
-- LIKE '%stem%' can't use a btree index. Fine at this size; revisit with a
-- pg_trgm GIN index if line_messages passes ~100k rows.
create or replace function public.count_keyword_matches(
  p_stems text[],
  p_since timestamptz default null
)
returns table (line_group_id uuid, stem text, n bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select m.line_group_id, s.stem, count(*)
  from public.line_messages m
  cross join unnest(p_stems) as s(stem)
  where m.text_content is not null
    and (p_since is null or m.sent_at >= p_since)
    and m.text_content ilike '%' || s.stem || '%'
  group by m.line_group_id, s.stem;
$$;

comment on function public.count_keyword_matches is
  'Substring counts per group for a caller-supplied vocabulary. Approximate by design.';

grant select  on public.group_message_stats            to authenticated;
grant select  on public.group_daily_counts             to authenticated;
grant execute on function public.count_keyword_matches to authenticated;
