# CLAUDE.md — working notes for this repo

## What this is

**LINE message archive** — captures messages from LINE transport group chats into a
searchable, per-group, exportable record. Owner: GEOID (Thailand). Timezone:
Asia/Bangkok.

> **The trip-intelligence product was removed on 17 Aug 2026.** `prd.md` still
> describes it in full and is now **historical**, not a spec — read it for context
> only. Trips, the review queue, the dashboard and the whole AI extraction pipeline
> were deleted at the owner's request; the product is now message capture, filtering
> and CSV export, nothing more. Do not reintroduce any of it without asking.

## Current state

The whole pipeline is: **LINE webhook → idempotent ingestion → per-group inbox →
CSV export**, with Google/email auth and org-scoped RLS.

- **Ingestion is live.** `app/api/webhooks/line/route.ts` verifies the LINE
  signature, stores messages/attachments idempotently, and (in `after()`) retrieves
  attachment binaries into a private Supabase Storage bucket.
- **Groups are allowlisted.** A group the bot joins registers itself as `pending`
  with a null `organization_id`; its messages are **quarantined** (raw event kept,
  no `line_messages` row) until an administrator approves it under **Settings →
  LINE groups**. This is the "add a new group" path — see `setGroupStatusAction`.
- **No AI, no background workers.** `lib/ai/*`, `lib/trips/*` and the
  process-message/process-queue endpoints are gone. `app/api/internal/retrieve-attachments`
  remains (attachment capture only). The pg_cron scheduler from migration 0011 was
  already UNSCHEDULED and should stay that way.
- **UI reads live data through `lib/data/*`** (`session`, `messages`, `groups`)
  using the RLS server client.

**Do not commit, push, or deploy unless explicitly asked.**

## Stack

- Next.js App Router (15.5.x) + TypeScript, React 19
- Tailwind CSS v3.4 (design tokens as CSS vars in `app/globals.css`); UI is
  hand-built components in `components/ui/*` — **no shadcn/ui, no TanStack Table**
- Supabase: Postgres + RLS, Auth (Google OAuth + email magic link, allowlist-gated),
  private Storage bucket `attachments`. Migrations in `supabase/migrations/` (0001–0011).
  **The trip/review tables still exist in the database** — only the application code
  was removed. No migration drops them.
- Zod for the webhook envelope and server env validation
- Vercel hosting
- Testing: Vitest unit tests (`tests/unit/*`) — 36 across signature verification and
  the message export/filter contract.

## Key modules

- `lib/line/*` — signature verify, webhook Zod envelope, LINE API client, idempotent
  `ingest`, attachment retrieval.
- `lib/data/groups.ts` — `listInboxGroups` (RLS, feeds the filter + export),
  `listAllGroups` + `countMessagesByGroup` (admin client, feeds Settings).
- `lib/data/messages.ts` — the paginated inbox read and `iterateMessages`, the
  batched generator the CSV export streams from.
- `lib/messages/{filters,csv}.ts` — the filter contract shared by the list and the
  export, and pure CSV serialization.
- `app/(dashboard)/settings/actions.ts` — `setGroupStatusAction` (approve / pause a
  group; admin-only, service-role client).

## The filter contract

`MessageFilters` (`q`, `type`, `status`, `group`) lives in the URL and is the single
source of truth for **both** the paginated list and the CSV export — the export is
defined as "everything matching what you're looking at", so the two can never
disagree. If you add a filter, add it to `parseMessageFilters`, `filtersToQuery`,
`hasActiveFilters` **and** both query builders in `lib/data/messages.ts`.

`type` and `status` are whitelisted against fixed vocabularies. `group` can't be —
groups are rows, and a newly approved group must work with no code change — so it is
gated on **UUID shape** only; RLS does the authorization.

## Design language — "dispatch console, clean & white"

- Pure white canvas, hairline (`--line`) structure, **one** accent:
  customs-ink green `--accent` (#0F5C4B). Accent only for active nav and primary
  actions.
- Status hues are low-chroma CSS vars (`--st-*`).
- Type roles: `font-sans` (Plex Sans, headings), `font-thai` (Plex Sans Thai, body
  incl. Thai names), `font-mono` (Plex Mono). **Every operational identifier**
  (LINE group id, timestamp, filename) is set in mono via `Code` / `CodeChip` —
  intentional, not decorative.

## Conventions

- Server Components by default; `"use client"` only for interactivity (inbox
  filters, group approve/pause, mobile nav).
- Correctness rules (filter parsing, CSV escaping, signature verification) belong in
  `lib/`, not components. Add tests with them.
- Dates: store UTC, display Asia/Bangkok via helpers in `lib/utils.ts`.
- Secrets are server-only. Signed URLs for private attachments are minted
  server-side and scoped to the caller's org via the RLS client.
- The service-role client bypasses RLS — every caller must do its own role check
  first (see `setGroupStatusAction`).
- supabase-js typed queries sometimes infer `never` on direct property access — cast
  results via `as unknown as RowType[]` (see `lib/data/*`).

## Commands

```bash
npm run dev        # local dev
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm test           # vitest run
npm run build      # production build
```

## Known rough edges

- `processing_status` is a leftover of the removed pipeline. New text messages still
  land as `queued` even though nothing consumes a queue; historical rows carry
  `processed` / `review_required`. The inbox still filters on it. Harmless, but if
  it ever confuses an operator, the honest fix is to stop writing `queued` in
  `lib/line/ingest.ts` and backfill.
- The trip/review tables and their RLS policies are still in the database and in
  `supabase/migrations/`, now unreferenced by any code.
