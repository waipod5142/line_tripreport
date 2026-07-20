-- ─────────────────────────────────────────────────────────────
-- 0005 · AI extractions, review queue, audit log
-- ─────────────────────────────────────────────────────────────

-- Every AI call is recorded with its prompt/schema/model version and input hash
-- so results are reproducible and reprocessable (§16.3).
create table public.ai_extractions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid not null references public.line_messages(id) on delete cascade,
  provider text not null,
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  input_hash text not null,
  output_json jsonb,
  overall_confidence numeric(5,4),
  status text not null,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (message_id, input_hash, prompt_version, model)
);
create index ai_extractions_organization_id_idx on public.ai_extractions(organization_id);
create index ai_extractions_message_idx on public.ai_extractions(message_id);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid references public.line_messages(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  reason_code text not null,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  proposed_changes jsonb,
  status text not null default 'open' check (status in ('open','in_review','resolved','dismissed')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index review_items_organization_id_idx on public.review_items(organization_id);
create index review_items_status_idx on public.review_items(status);

-- Append-only audit trail for every automatic and manual change (§3.1.6).
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_type text not null,
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_json jsonb,
  after_json jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_organization_id_idx on public.audit_logs(organization_id);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

create trigger set_updated_at before update on public.review_items
  for each row execute function public.set_updated_at();
