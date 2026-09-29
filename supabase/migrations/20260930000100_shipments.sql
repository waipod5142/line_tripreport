-- ─────────────────────────────────────────────────────────────
-- 0016 · Shipments and shipment_events
--
-- A shipment is one row of the customer's daily plan (e.g. 1699702). Its
-- progress through the six stages is a set of EVENTS, each pointing at the LINE
-- message that reported it:
--
--     picking → departed → arrived → unloaded → pallet_pickup → pallet_returned
--
-- Events start as 'suggested' (a Thai keyword rule matched the message — see
-- lib/shipments/extract.ts) and become 'confirmed' or 'rejected' when a person
-- decides. Nothing here is AI and nothing runs on a schedule.
--
-- The CURRENT stage is deliberately not stored on shipments. It is derived from
-- confirmed events (lib/shipments/stages.ts), so it cannot drift from the
-- evidence behind it.
--
-- SECURITY: both tables are org-scoped by RLS. There is no view here; any view
-- added later MUST be `with (security_invoker = true)` (see 0013). The ingest
-- path writes suggestions with the service-role key, which bypasses RLS.
-- ─────────────────────────────────────────────────────────────

create table public.shipments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  shipment_no      text not null,
  plan_date        date not null,
  delivery_date    date,
  delivery_date_end date,
  time_window      text,
  ship_to_code     text,
  ship_to_name     text,
  city             text,
  province         text,
  qty              integer,
  pallets          integer,
  plate            text,
  driver_name      text,
  driver_phone     text,
  -- 'loaded' = ขึ้นแล้วส่งเลย, 'pending' = ขึ้นค้างส่ง (the sheet's two sections)
  section          text check (section in ('loaded', 'pending')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint shipments_no_format check (shipment_no ~ '^[0-9]{7}$'),
  constraint shipments_org_no_key unique (organization_id, shipment_no)
);

create index shipments_org_delivery_idx
  on public.shipments (organization_id, delivery_date desc);

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

create table public.shipment_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  shipment_id      uuid not null references public.shipments(id) on delete cascade,
  stage            text not null check (stage in (
                     'picking', 'departed', 'arrived',
                     'unloaded', 'pallet_pickup', 'pallet_returned')),
  -- null only for an event a person recorded by hand with no message behind it
  line_message_id  uuid references public.line_messages(id) on delete cascade,
  source           text not null default 'rule' check (source in ('rule', 'manual')),
  status           text not null default 'suggested'
                     check (status in ('suggested', 'confirmed', 'rejected')),
  occurred_at      timestamptz not null,
  confirmed_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  -- Re-processing a message (webhook retry, backfill) must not duplicate events.
  constraint shipment_events_dedupe unique (shipment_id, line_message_id, stage)
);

create index shipment_events_shipment_idx
  on public.shipment_events (shipment_id, occurred_at);
create index shipment_events_message_idx
  on public.shipment_events (line_message_id);
create index shipment_events_org_status_idx
  on public.shipment_events (organization_id, status);

-- ── RLS ────────────────────────────────────────────────────────
alter table public.shipments enable row level security;
create policy shipments_select on public.shipments
  for select to authenticated
  using (organization_id = public.auth_org_id());
create policy shipments_write on public.shipments
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

alter table public.shipment_events enable row level security;
create policy shipment_events_select on public.shipment_events
  for select to authenticated
  using (organization_id = public.auth_org_id());
create policy shipment_events_write on public.shipment_events
  for all to authenticated
  using (organization_id = public.auth_org_id() and public.is_org_writer())
  with check (organization_id = public.auth_org_id() and public.is_org_writer());

-- PostgREST auto-exposes public; signed-out callers get nothing either way
-- (policies are `to authenticated`), but don't leave the grant lying around.
revoke all on public.shipments from anon;
revoke all on public.shipment_events from anon;
