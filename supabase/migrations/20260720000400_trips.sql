-- ─────────────────────────────────────────────────────────────
-- 0004 · Trip engine: trips, vehicles, drivers, containers, events, links
-- ─────────────────────────────────────────────────────────────

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_line_group_id uuid references public.line_groups(id) on delete set null,
  shipment_code text,
  normalized_shipment_code text,
  assignment_date date,
  status text not null default 'draft'
    check (status in ('draft','assigned','at_origin','border_processing','released',
                      'in_transit','arrived','loading','unloading','completed',
                      'cancelled','exception')),
  origin_name text,
  destination_name text,
  destination_province text,
  destination_map_url text,
  planned_delivery_at timestamptz,
  actual_arrival_at timestamptz,
  completed_at timestamptz,
  carrier_code text,
  latest_status_text text,
  summary_th text,
  summary_en text,
  confirmation_status text not null default 'unconfirmed'
    check (confirmation_status in ('unconfirmed','confirmed')),
  manually_overridden_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_organization_id_idx on public.trips(organization_id);
create index trips_status_idx on public.trips(status);
create index trips_assignment_date_idx on public.trips(assignment_date);

-- Shipment code is the primary business key. Cross-group matching is disabled
-- initially, so uniqueness is scoped to (org, group). A future toggle can add
-- an org-wide index; this one enforces "one trip per shipment code per group".
create unique index trips_shipment_group_uniq
  on public.trips(organization_id, primary_line_group_id, normalized_shipment_code)
  where normalized_shipment_code is not null;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  registration_display text not null,
  registration_normalized text not null,
  vehicle_type text,
  brand text,
  country_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, registration_normalized)
);

create table public.trip_vehicles (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  role text not null check (role in ('tractor','trailer','other')),
  valid_from timestamptz,
  valid_to timestamptz,
  source_message_id uuid references public.line_messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index trip_vehicles_trip_idx on public.trip_vehicles(trip_id);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name_th text,
  name_en text,
  phone_display text,
  phone_normalized text,
  line_member_id uuid references public.line_members(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drivers_organization_id_idx on public.drivers(organization_id);

create table public.trip_drivers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  valid_from timestamptz,
  valid_to timestamptz,
  source_message_id uuid references public.line_messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index trip_drivers_trip_idx on public.trip_drivers(trip_id);

create table public.trip_containers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  container_number text not null,
  container_role text check (container_role in ('loaded','empty','eco','unknown')),
  source_message_id uuid references public.line_messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index trip_containers_trip_idx on public.trip_containers(trip_id);

-- Timeline events. idempotency_key = trip + type + normalized time + source msg,
-- so retries never duplicate an event (FR-LINE-011, §14.1).
create table public.trip_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  event_type text not null,
  event_at timestamptz,
  description text,
  raw_label text,
  source_message_id uuid references public.line_messages(id) on delete set null,
  source_type text not null check (source_type in ('line','manual','integration','system')),
  confidence numeric(5,4),
  confirmation_status text not null default 'unconfirmed'
    check (confirmation_status in ('unconfirmed','confirmed')),
  idempotency_key text unique not null,
  is_void boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trip_events_trip_idx on public.trip_events(trip_id);
create index trip_events_organization_id_idx on public.trip_events(organization_id);
create index trip_events_event_at_idx on public.trip_events(event_at);

create table public.message_trip_links (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.line_messages(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  link_method text not null,
  confidence numeric(5,4),
  confirmed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (message_id, trip_id)
);
create index message_trip_links_trip_idx on public.message_trip_links(trip_id);

create trigger set_updated_at before update on public.trips
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.drivers
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.trip_events
  for each row execute function public.set_updated_at();
