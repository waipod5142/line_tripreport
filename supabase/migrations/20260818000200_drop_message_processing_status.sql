-- ─────────────────────────────────────────────────────────────
-- 0014 · Drop line_messages.processing_status
--
-- The column drove the AI extraction queue: text landed as 'queued' for the
-- worker, media as 'stored', everything else as 'processed'. The worker was
-- removed on 17 Aug, so since then the value has been a pure restatement of
-- message_type — measured across every message captured after the removal, with
-- no exceptions:
--
--     text     → queued     183
--     image    → stored     577
--     location → processed   17
--     sticker  → processed    3
--
-- It told an operator nothing the type icon didn't already, and 'queued' was
-- actively misleading: it implied work was pending that nothing would ever do.
-- A few July rows still carried 'processing' and 'review_required' as fossils of
-- the old pipeline.
--
-- NOT TO BE CONFUSED WITH webhook_events.processing_status, which is kept: that
-- one records whether a raw LINE delivery was stored or failed, and is the only
-- signal that ingestion itself broke.
-- ─────────────────────────────────────────────────────────────

alter table public.line_messages
  drop column if exists processing_status;
