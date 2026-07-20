-- ─────────────────────────────────────────────────────────────
-- 0009 · Auth provisioning
-- Google OAuth lets anyone with a Google account authenticate, so access is
-- gated by an allowlist: a profile (and therefore any data access via RLS) is
-- created only for allowlisted emails. Everyone else gets a session but no
-- profile → auth_org_id() is null → RLS returns nothing.
-- ─────────────────────────────────────────────────────────────

create table public.allowed_emails (
  email text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('system_administrator','operations_manager','dispatcher','viewer')),
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
create policy allowed_emails_admin on public.allowed_emails
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.auth_role() = 'system_administrator')
  with check (organization_id = public.auth_org_id() and public.auth_role() = 'system_administrator');

-- On new auth user, provision a profile iff the email is allowlisted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allow public.allowed_emails%rowtype;
begin
  select * into allow from public.allowed_emails where lower(email) = lower(new.email);
  if found then
    insert into public.profiles (id, organization_id, role, display_name)
    values (
      new.id,
      allow.organization_id,
      allow.role,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email)
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed the owner as system administrator of GEOID.
insert into public.allowed_emails (email, organization_id, role)
values ('waipody@gmail.com', '11111111-1111-1111-1111-111111111111', 'system_administrator')
on conflict (email) do nothing;
