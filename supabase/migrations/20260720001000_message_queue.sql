-- ─────────────────────────────────────────────────────────────
-- 0010 · Message processing queue
-- The queue is the line_messages table itself: a message with
-- processing_status = 'queued' is work to do. These columns add retry tracking
-- and dead-letter visibility (PRD §14.2). A message that exhausts its attempts
-- ends in 'failed' with last_error set.
-- ─────────────────────────────────────────────────────────────

alter table public.line_messages
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists last_error text;

-- Fast lookup of pending work.
create index if not exists line_messages_queue_idx
  on public.line_messages (processing_status, sent_at)
  where processing_status = 'queued';
