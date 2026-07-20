-- ─────────────────────────────────────────────────────────────
-- 0001 · Extensions and shared helpers
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Keep updated_at fresh on any mutable table that opts in via trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
