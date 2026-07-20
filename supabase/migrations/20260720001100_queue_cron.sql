-- ─────────────────────────────────────────────────────────────
-- 0011 · Queue scheduler extensions
-- pg_cron drives the reliable backstop (every minute) and pg_net makes the
-- outbound HTTP call to the /api/internal/process-queue endpoint — independent
-- of the Vercel plan's cron limits.
--
-- The cron JOB itself is NOT defined here because it embeds INTERNAL_JOB_SECRET;
-- it is created out-of-band (kept only in the private DB, never in git):
--
--   select cron.schedule('ai-process-queue', '* * * * *', $$
--     select net.http_post(
--       url := 'https://<app-domain>/api/internal/process-queue',
--       headers := jsonb_build_object('Content-Type','application/json',
--                                     'x-internal-secret','<INTERNAL_JOB_SECRET>'),
--       body := '{}'::jsonb
--     );
--   $$);
-- ─────────────────────────────────────────────────────────────

create extension if not exists pg_net;
create extension if not exists pg_cron;
