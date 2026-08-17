-- ─────────────────────────────────────────────────────────────
-- 0012 · Drop the trip engine
--
-- The trip-intelligence product (AI extraction → structured trip records →
-- review queue → operations dashboard) was removed from the application on
-- 17 Aug 2026. This migration removes the database objects that supported it,
-- which nothing has referenced since.
--
-- Verified before writing this: no foreign key points into any dropped table
-- from a surviving one, no function/trigger/view references them, and no cron
-- job exists. The 50 rows they held were archived to
-- supabase/archive/trip-engine-archive-2026-08-17.json (gitignored — it carries
-- driver names and phone numbers).
--
-- Kept deliberately, despite no application code querying them:
--   organizations  — FK target for every tenant-scoped table
--   allowed_emails — read by handle_new_user(); dropping it breaks login
--                    provisioning for new users
--
-- Supersedes migrations 0004 (trips), 0005 (ai_ops_audit) and 0011
-- (queue_cron). Those files are left in place so the history still replays in
-- order; this migration is the net effect.
-- ─────────────────────────────────────────────────────────────

-- ── Trip engine tables, children before parents ──────────────
-- RLS policies, indexes and triggers drop with their table.
drop table if exists public.trip_vehicles;
drop table if exists public.trip_drivers;
drop table if exists public.trip_containers;
drop table if exists public.trip_events;
drop table if exists public.message_trip_links;
drop table if exists public.review_items;
drop table if exists public.ai_extractions;
drop table if exists public.audit_logs;
drop table if exists public.trips;
drop table if exists public.vehicles;
drop table if exists public.drivers;

-- ── Dead columns on line_messages ────────────────────────────
-- All three were written only by the AI worker:
--   classification       — the extractor's message category
--   processing_attempts  — queue retry counter
--   last_error           — queue failure detail
-- processing_status is KEPT: ingestion still writes it (queued / stored /
-- processed) to record how a message was captured.
alter table public.line_messages
  drop column if exists classification,
  drop column if exists processing_attempts,
  drop column if exists last_error;

-- ── Scheduler extensions ─────────────────────────────────────
-- Enabled by 0011 solely to drive the AI queue. No jobs remain scheduled.
drop extension if exists pg_cron;
drop extension if exists pg_net;
