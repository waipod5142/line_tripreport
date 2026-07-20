-- ─────────────────────────────────────────────────────────────
-- 0006 · Row Level Security
-- Every tenant table is scoped to the caller's organization. The service_role
-- key (used only by the server-side webhook/worker) bypasses RLS entirely, so
-- ingestion still works; interactive users are always confined to their org.
-- ─────────────────────────────────────────────────────────────

-- SECURITY DEFINER so reading profiles inside a policy can't recurse into the
-- profiles RLS policy. search_path pinned to avoid hijacking.
create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_org_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid())
      in ('system_administrator','operations_manager','dispatcher'),
    false
  );
$$;

-- ── organizations ──────────────────────────────────────────────
alter table public.organizations enable row level security;
create policy organizations_select on public.organizations
  for select to authenticated using (id = public.auth_org_id());
create policy organizations_admin on public.organizations
  for all to authenticated
  using (id = public.auth_org_id() and public.auth_role() = 'system_administrator')
  with check (id = public.auth_org_id() and public.auth_role() = 'system_administrator');

-- ── profiles ───────────────────────────────────────────────────
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles
  for select to authenticated using (organization_id = public.auth_org_id());
create policy profiles_admin on public.profiles
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.auth_role() = 'system_administrator')
  with check (organization_id = public.auth_org_id() and public.auth_role() = 'system_administrator');

-- ── line_groups ────────────────────────────────────────────────
-- Admins can also see pending groups that have no org yet.
alter table public.line_groups enable row level security;
create policy line_groups_select on public.line_groups
  for select to authenticated using (
    organization_id = public.auth_org_id()
    or (organization_id is null and public.auth_role() = 'system_administrator')
  );
create policy line_groups_write on public.line_groups
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- ── org-scoped tables with a straightforward organization_id column ──
-- line_members
alter table public.line_members enable row level security;
create policy line_members_select on public.line_members
  for select to authenticated using (organization_id = public.auth_org_id());
create policy line_members_write on public.line_members
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- line_messages
alter table public.line_messages enable row level security;
create policy line_messages_select on public.line_messages
  for select to authenticated using (organization_id = public.auth_org_id());
create policy line_messages_write on public.line_messages
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- message_attachments
alter table public.message_attachments enable row level security;
create policy message_attachments_select on public.message_attachments
  for select to authenticated using (organization_id = public.auth_org_id());
create policy message_attachments_write on public.message_attachments
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- trips
alter table public.trips enable row level security;
create policy trips_select on public.trips
  for select to authenticated using (organization_id = public.auth_org_id());
create policy trips_write on public.trips
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- vehicles
alter table public.vehicles enable row level security;
create policy vehicles_select on public.vehicles
  for select to authenticated using (organization_id = public.auth_org_id());
create policy vehicles_write on public.vehicles
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- drivers
alter table public.drivers enable row level security;
create policy drivers_select on public.drivers
  for select to authenticated using (organization_id = public.auth_org_id());
create policy drivers_write on public.drivers
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- trip_events
alter table public.trip_events enable row level security;
create policy trip_events_select on public.trip_events
  for select to authenticated using (organization_id = public.auth_org_id());
create policy trip_events_write on public.trip_events
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- ai_extractions
alter table public.ai_extractions enable row level security;
create policy ai_extractions_select on public.ai_extractions
  for select to authenticated using (organization_id = public.auth_org_id());
create policy ai_extractions_write on public.ai_extractions
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- review_items
alter table public.review_items enable row level security;
create policy review_items_select on public.review_items
  for select to authenticated using (organization_id = public.auth_org_id());
create policy review_items_write on public.review_items
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- audit_logs: readable by managers/admin in the org; append-only for writers.
alter table public.audit_logs enable row level security;
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (
    organization_id = public.auth_org_id()
    and public.auth_role() in ('system_administrator','operations_manager')
  );
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- ── child tables scoped through their parent trip ──────────────
alter table public.trip_vehicles enable row level security;
create policy trip_vehicles_select on public.trip_vehicles
  for select to authenticated using (exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()));
create policy trip_vehicles_write on public.trip_vehicles
  for all to authenticated
  using (public.is_org_writer() and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()))
  with check (public.is_org_writer() and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()));

alter table public.trip_drivers enable row level security;
create policy trip_drivers_select on public.trip_drivers
  for select to authenticated using (exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()));
create policy trip_drivers_write on public.trip_drivers
  for all to authenticated
  using (public.is_org_writer() and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()))
  with check (public.is_org_writer() and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()));

alter table public.trip_containers enable row level security;
create policy trip_containers_select on public.trip_containers
  for select to authenticated using (exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()));
create policy trip_containers_write on public.trip_containers
  for all to authenticated
  using (public.is_org_writer() and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()))
  with check (public.is_org_writer() and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()));

alter table public.message_trip_links enable row level security;
create policy message_trip_links_select on public.message_trip_links
  for select to authenticated using (exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()));
create policy message_trip_links_write on public.message_trip_links
  for all to authenticated
  using (public.is_org_writer() and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()))
  with check (public.is_org_writer() and exists (
    select 1 from public.trips t
    where t.id = trip_id and t.organization_id = public.auth_org_id()));

-- ── webhook_events: raw pre-org data, admin read only (service_role writes) ──
alter table public.webhook_events enable row level security;
create policy webhook_events_admin_select on public.webhook_events
  for select to authenticated using (public.auth_role() = 'system_administrator');
