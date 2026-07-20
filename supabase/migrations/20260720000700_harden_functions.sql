-- ─────────────────────────────────────────────────────────────
-- 0007 · Function hardening (addresses Supabase security advisors)
-- Pin search_path on the trigger fn, and expose the SECURITY DEFINER auth
-- helpers only to roles that actually need them (RLS runs as authenticated;
-- the server worker uses service_role). anon loses RPC access entirely.
-- ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.auth_org_id() from public, anon;
revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.is_org_writer() from public, anon;

grant execute on function public.auth_org_id() to authenticated, service_role;
grant execute on function public.auth_role() to authenticated, service_role;
grant execute on function public.is_org_writer() to authenticated, service_role;
