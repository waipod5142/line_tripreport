# CLAUDE.md — working notes for this repo

## What this is

LINE Trip Intelligence — an operations tool that turns LINE transport group chats
into structured, reviewable trip records. Full spec in `prd.md` (read it before
non-trivial work; it also carries an "Implementation status" banner reconciling the
spec with what's built). Owner: GEOID (Thailand). Timezone: Asia/Bangkok.

## Current state

**Full stack, wired to live data.** The pipeline runs end to end:

LINE webhook → idempotent ingestion → (manual) AI extraction → deterministic trip
engine → live operations UI, with Google/email auth and org-scoped RLS.

- **Ingestion is live.** `app/api/webhooks/line/route.ts` verifies the LINE
  signature, stores messages/attachments idempotently, and (in `after()`) retrieves
  attachment binaries into a private Supabase Storage bucket.
- **AI runs on manual trigger, not automatically.** A message is only extracted
  when a human clicks **Run AI** (message inbox). There's also **Re-summarise** on a
  trip and **Accept / Dismiss** on a review item. A pg_cron/pg_net scheduler exists
  (migration 0011) but is intentionally **UNSCHEDULED** — the product decision was
  manual firing. Don't re-enable auto-processing without asking.
- **UI reads live data through `lib/data/*`** (`session`, `messages`, `trips`,
  `reviews`) using the RLS server client — this is the seam, replacing the old
  `lib/mock/data.ts`. Mock data is legacy; new screens read from `lib/data/*`.

Some recent work (reviews Accept/Dismiss wiring, the matcher fix, attachment
viewing, Re-summarise placement) may live in the working tree ahead of a commit —
**do not commit, push, or deploy unless explicitly asked.**

## Stack

- Next.js App Router (15.5.x) + TypeScript, React 19
- Tailwind CSS v3.4 (design tokens as CSS vars in `app/globals.css`); UI is
  hand-built components in `components/ui/*` — **no shadcn/ui, no TanStack Table**
- Supabase: Postgres + RLS, Auth (Google OAuth + email magic link, allowlist-gated),
  private Storage bucket `attachments`. Migrations in `supabase/migrations/` (0001–0011).
- AI: **OpenRouter**, model `moonshotai/kimi-k3` (env `AI_MODEL`). NOT OpenAI.
  Prompt v1.1 (few-shot Thai), schema v1.0. `OpenRouterExtractor` implements the
  `TripExtractor` interface.
- Zod for the AI extraction contract (`lib/ai/schemas.ts`) and summariser
- Vercel hosting (Hobby: 60s function cap — kimi-k3 is ~52s, so calls are single and
  synchronous, well within budget)
- Testing: Vitest unit tests (`tests/unit/*`) — currently 36 across confidence,
  normalizers, status-engine, signature, matcher. Playwright/RTL are planned, not set up.

## Key modules

- `lib/line/*` — signature verify, webhook Zod envelope, LINE API client, idempotent
  `ingest`, attachment retrieval.
- `lib/ai/*` — `extractor` (OpenRouter), `schemas`, `process` (`processMessageById`,
  supports an `extractionOverride` to replay a stored extraction with no AI call),
  `summariser`, `queue`, `prompts/extraction`.
- `lib/trips/*` — the deterministic engine: `normalizers`, `matcher`, `confidence`
  (thresholds: auto-apply 0.90, review 0.70), `status-engine`, `apply-extraction`
  (create/update trips, plus `acceptReviewItem` / `dismissReviewItem`).
- `app/(dashboard)/*/actions.ts` — Server Actions for the manual triggers
  (writer-only where they mutate; `getAttachmentUrlAction` is any-member view).
- `app/api/internal/*` — secret-authed (`INTERNAL_JOB_SECRET`) worker endpoints.

## Design language — "dispatch console, clean & white"

- Pure white canvas, hairline (`--line`) structure, **one** accent:
  customs-ink green `--accent` (#0F5C4B). Keep it disciplined — accent only for
  active nav, primary actions, and the in-transit / journey states.
- Status hues are low-chroma and defined as CSS vars (`--st-*`). Use the
  `StatusBadge` / `StatusPill` components, not ad-hoc colors.
- Type roles: `font-sans` (Plex Sans, headings), `font-thai` (Plex Sans Thai, body
  incl. Thai names), `font-mono` (Plex Mono). **Every operational identifier**
  (shipment code, container number, plate, timestamp) is set in mono via the
  `Code` / `CodeChip` components — this is intentional, not decorative.
- Signature element: the **journey rail** (`components/trips/journey-rail.tsx`).
  Only render it for the real lifecycle sequence.

## Conventions

- Server Components by default; mark client components (`"use client"`) only when
  they need interactivity (tables with filters, review/AI actions, mobile nav).
- Money-path / correctness rules (matching, normalization, signature verification)
  belong in `lib/`, not components. Add tests with them (PRD §19).
- Dates: store UTC, display Asia/Bangkok via helpers in `lib/utils.ts`. Don't call
  `new Date()` for display formatting without a timezone.
- AI never writes to the DB directly. It returns Zod-validated JSON
  (`lib/ai/schemas.ts`); deterministic rules in `lib/trips/*` decide what to persist
  (PRD §16, §23).
- Secrets are server-only. Never import service-role keys or AI keys into client
  components. Signed URLs for private attachments are minted server-side and scoped
  to the caller's org via the RLS client.
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

## What's next (see prd.md §20)

Phases 0–3 are substantially built (ingestion, AI + trip engine, operations UI).
Remaining: Settings/Reviews polish, persisting the remaining review actions
(Link-to-trip / Reprocess), and Phase 4 hardening — RLS/load tests, monitoring, an
AI regression set, retention config, and the single-group pilot. Migrations before
the code that depends on them.
