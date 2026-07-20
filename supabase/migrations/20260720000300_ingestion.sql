-- ─────────────────────────────────────────────────────────────
-- 0003 · Ingestion: raw webhook events, messages, attachments
-- Evidence-first — the original payload is preserved before any AI runs.
-- ─────────────────────────────────────────────────────────────

-- Raw LINE webhook envelopes. No organization_id: these arrive before the
-- group is resolved to an org, and dedupe by webhook_event_id guarantees
-- idempotency (FR-LINE-004).
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id text unique not null,
  destination text,
  event_type text not null,
  event_timestamp timestamptz,
  received_at timestamptz not null default now(),
  is_redelivery boolean not null default false,
  signature_verified boolean not null,
  raw_payload jsonb not null,
  processing_status text not null default 'received'
    check (processing_status in ('received','stored','queued','processing','processed','review_required','failed')),
  processing_attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index webhook_events_status_idx on public.webhook_events(processing_status);

create table public.line_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  webhook_event_id uuid not null references public.webhook_events(id) on delete cascade,
  line_message_id text unique,
  line_group_id uuid references public.line_groups(id) on delete set null,
  line_member_id uuid references public.line_members(id) on delete set null,
  message_type text not null,
  text_content text,
  quoted_line_message_id text,
  sent_at timestamptz not null,
  is_unsent boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received','stored','queued','processing','processed','review_required','failed')),
  classification text,
  raw_message jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index line_messages_organization_id_idx on public.line_messages(organization_id);
create index line_messages_group_idx on public.line_messages(line_group_id);
create index line_messages_sent_at_idx on public.line_messages(sent_at desc);

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  line_message_id uuid not null references public.line_messages(id) on delete cascade,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  storage_bucket text not null default 'attachments',
  storage_path text not null,
  thumbnail_path text,
  extracted_text text,
  retrieval_status text not null default 'pending'
    check (retrieval_status in ('pending','retrieving','stored','failed')),
  scan_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index message_attachments_message_idx on public.message_attachments(line_message_id);
create index message_attachments_organization_id_idx on public.message_attachments(organization_id);

create trigger set_updated_at before update on public.webhook_events
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.line_messages
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.message_attachments
  for each row execute function public.set_updated_at();
