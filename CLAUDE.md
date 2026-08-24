# CLAUDE.md — working notes for this repo

## What this is

A **LINE message archive** for GEOID (Thailand). It captures messages from LINE
transport group chats and makes them searchable, filterable by group, and
exportable to CSV. That is the whole product.

Timezone: Asia/Bangkok. Thai is the primary language of the message content.

```
LINE group chat
  └─ POST /api/webhooks/line     signature-verified, idempotent
       └─ line_messages (+ attachment binaries → private Storage bucket)
            ├─ /messages         search · filter by group/type · paginate
            │    └─ /messages/export   streamed CSV of the current filter
            └─ /dashboard        per-group volume, health alerts, keyword counts
```

## Not in this project

Do not add these back without asking — they were built, then deliberately removed:
**AI/LLM extraction, trip records, the trip matching engine, a review queue, an
operations dashboard, and background job queues.** There is no AI provider
dependency and no scheduler.

`prd.md` describes that older product in full. It is **historical context, not a
spec** — it carries a SUPERSEDED banner. Trust this file and the code over it.

## Stack

- Next.js App Router (15.5.x), React 19, TypeScript
- Tailwind CSS v3.4; design tokens are CSS vars in `app/globals.css`. UI is
  hand-built in `components/ui/*` — **no shadcn/ui, no component library, no
  TanStack Table**
- Supabase: Postgres + RLS, Auth (Google OAuth + email magic link, allowlist-gated),
  private Storage bucket `attachments`
- Zod for the webhook envelope and server env validation
- Vitest (`tests/unit/*`) — 54 tests over signature verification, the
  export/filter contract and the dashboard's derivations. No component or E2E
  tests are set up.
- Hosted on Vercel

## Database

8 tables, RLS on all of them, migrations in `supabase/migrations/`:

| Table | Role |
|---|---|
| `organizations` | Tenant root; FK target for every scoped table |
| `profiles` | Signed-in users; drives `auth_org_id()` / `auth_role()` |
| `allowed_emails` | Login allowlist |
| `line_groups` | Chats the bot has joined, and their capture status |
| `line_members` | Message senders |
| `webhook_events` | Every raw LINE delivery; the idempotency ledger |
| `line_messages` | The archive |
| `message_attachments` | Stored images/files + retrieval state |

**`organizations` and `allowed_emails` look unused and are not.** No application
code queries them, but `organizations` anchors every foreign key and
`allowed_emails` is read by the `handle_new_user` trigger — dropping it silently
breaks profile provisioning for new logins.

Plus two views and one function for the dashboard (migration 0013):
`group_message_stats`, `group_daily_counts`, `count_keyword_matches()`.

> **Any new view MUST be created `with (security_invoker = true)`.** Views run
> with their *owner's* rights by default and PostgREST auto-exposes everything in
> `public`, so without the flag a view serves every org's rows to any signed-in
> user, straight past RLS. Same for functions: leave them `security invoker`
> (the default). Getting this wrong is a data leak, not a bug, and a
> "does the page render" check passes either way — verify with the anon key.

After any migration, regenerate `lib/supabase/types.ts` (Supabase MCP
`generate_typescript_types`), or supabase-js types against a stale schema.

## Two things to understand before changing anything

### 1. Groups are allowlisted, and silence is the failure mode

A group the bot is added to registers itself as `status='pending'` with a null
`organization_id`. Until an administrator approves it, its messages are
**quarantined**: the raw event is kept in `webhook_events`, but no `line_messages`
row is created, so the group is simply invisible in the UI with no error anywhere.

Approval happens in **Settings → LINE groups** (`setGroupStatusAction`). It uses the
service-role client on purpose: a pending group has no org, and the `line_groups`
write policy requires the row to already match the caller's org, so the first claim
cannot go through RLS. **The admin role check in that action is the entire
authorization boundary.**

If someone reports "my new group isn't showing up", this is why.

### 2. The filter contract binds the list and the export together

`MessageFilters` (`q`, `type`, `group`) lives in the URL and is the single
source of truth for **both** the paginated list and the CSV export. The export is
defined as *everything matching what you're currently looking at* — so the two can
never disagree, and export size isn't bounded by what the page loaded.

Adding a filter means touching all five: `parseMessageFilters`, `filtersToQuery`,
`hasActiveFilters`, and **both** query builders in `lib/data/messages.ts`.

`type` is whitelisted against a fixed vocabulary. `group` cannot be —
groups are rows, and a newly approved group must work with no code change — so it is
validated on **UUID shape** only, and RLS does the authorization.

## Layout

Routes: `/login`, `/dashboard`, `/messages`, `/messages/export`, `/settings`, plus
`/api/webhooks/line`, `/api/internal/retrieve-attachments`, and the auth callbacks.
`/` redirects to `/messages` — the inbox is where the work happens; the dashboard
is a glance, not a destination.

- `lib/line/*` — signature verify (raw-body HMAC-SHA256, timing-safe), Zod webhook
  envelope, LINE API client, idempotent `ingest`, attachment retrieval
- `lib/data/*` — the read seam, all through the RLS server client:
  `messages` (paginated read + `iterateMessages`, the batched generator the export
  streams from), `groups` (`listInboxGroups` for the filter; `listAllGroups` +
  `countMessagesByGroup` for Settings, admin client), `session`
- `lib/messages/*` — `filters` (the contract above), `csv` (pure serialization:
  RFC 4180 quoting plus spreadsheet-formula neutralisation) and `keywords` (the
  dashboard's Thai vocabulary — read the header before editing it)
- `lib/dashboard/metrics.ts` — pure dashboard logic (alert thresholds, when a
  trend is meaningless). Deliberately split from `lib/data/stats.ts`, which is
  `server-only`: tests can't import a `server-only` module.
- `lib/supabase/*` — `client` (browser), `server` (RLS, RSC/route handlers),
  `admin` (service role), `middleware` (session refresh + route gating)

## Design language — "dispatch console, clean & white"

- Pure white canvas, hairline (`--line`) structure, **one** accent: customs-ink
  green `--accent` (#0F5C4B), used only for active nav and primary actions
- Status hues are low-chroma CSS vars (`--st-*`)
- Type roles: `font-sans` (Plex Sans, headings), `font-thai` (Plex Sans Thai, body
  including Thai sender names), `font-mono` (Plex Mono). **Every operational
  identifier** — LINE group id, timestamp, filename — is set in mono via the
  `Code` / `CodeChip` components. Intentional, not decorative.

## Conventions

- Server Components by default; `"use client"` only where there is real
  interactivity (inbox filters, group approve/pause, mobile nav)
- Correctness rules (filter parsing, CSV escaping, signature verification) live in
  `lib/`, never in components, and ship with tests
- Dates: store UTC, display Asia/Bangkok via the helpers in `lib/utils.ts`. Never
  format for display without a timezone.
- Secrets are server-only. Signed URLs for private attachments are minted
  server-side and scoped to the caller's org via the RLS client.
- The service-role client bypasses RLS — every caller must do its own role check
  first
- supabase-js typed queries sometimes infer `never` on direct property access; cast
  results via `as unknown as RowType[]` (see `lib/data/*`)
- **Do not commit, push, or deploy unless explicitly asked**

## Commands

```bash
npm run dev        # local dev
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm test           # vitest run
npm run build      # production build
```

## Gotchas

- **Stale `.next` lies to you.** `tsc --noEmit` reports missing modules for routes
  you deleted, and `next start` throws missing-vendor-chunk errors while `next dev`
  is fine. `rm -rf .next` before believing a failure.
- **Lint errors are fatal to the build** — notably
  `react/no-unescaped-entities` (use `’`, not `'`).
- **`webhook_events.processing_status` is real; there is no longer one on
  `line_messages`.** The latter drove the removed AI queue and had decayed into a
  restatement of `message_type` (`text`→queued, `image`→stored, …), so migration
  0014 dropped it. The one on `webhook_events` records whether a raw LINE
  delivery stored or failed — that's the only signal ingestion itself broke.
- Early migrations create trip-engine objects that a later migration drops. A fresh
  replay is correct, just wasteful — don't retro-edit migrations that have been
  applied.
- **`@supabase/ssr` is pinned at 0.5.2 and its client doesn't propagate the `Args`
  generic to `.rpc()`** — TypeScript collapses the argument to `undefined` and
  rejects every call, even though the generated types are right and the same call
  on a plain `supabase-js` client compiles. `fetchKeywordCounts` in
  `lib/data/stats.ts` is the one place that casts around it. The real fix is
  upgrading to 0.7.x, which needs an auth/middleware review.
- The npm package name is still `line-trip-intelligence`. Cosmetic only.
