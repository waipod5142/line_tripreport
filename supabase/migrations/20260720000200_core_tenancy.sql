-- ─────────────────────────────────────────────────────────────
-- 0002 · Core multi-tenancy: organizations, profiles, groups, members
-- ─────────────────────────────────────────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  timezone text not null default 'Asia/Bangkok',
  locale text not null default 'th-TH',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One profile per auth user, pinned to exactly one organization.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  display_name text,
  role text not null default 'viewer'
    check (role in ('system_administrator','operations_manager','dispatcher','viewer','integration_service')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_organization_id_idx on public.profiles(organization_id);

create table public.line_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  line_group_id text unique not null,
  group_name text,
  status text not null default 'pending'
    check (status in ('pending','active','paused','blocked')),
  joined_at timestamptz,
  last_message_at timestamptz,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index line_groups_organization_id_idx on public.line_groups(organization_id);

create table public.line_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  line_user_id text not null,
  display_name text,
  picture_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, line_user_id)
);

create trigger set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.line_groups
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.line_members
  for each row execute function public.set_updated_at();
