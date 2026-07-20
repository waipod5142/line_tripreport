# CLAUDE.md — working notes for this repo

## What this is

LINE Trip Intelligence — an operations tool that turns LINE transport group chats
into structured, reviewable trip records. Full spec in `prd.md` (read it before
non-trivial work). Owner: GEOID (Thailand). Timezone: Asia/Bangkok.

## Current state

**UI-first scaffold.** All screens run on mock data from `lib/mock/data.ts`. No
backend is wired yet (Supabase, LINE webhook, and the AI worker are planned per the
PRD phases). The UI reads data only through the accessor functions in that module,
so replacing it with real Supabase queries is the seam to work along.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS (design tokens as CSS vars in `app/globals.css`)
- Zod for the AI extraction contract
- Planned: Supabase (DB/Auth/Storage/RLS), LINE Messaging API, OpenRouter AI

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
  they need interactivity (tables with filters, review actions, mobile nav).
- Money-path / correctness rules (matching, normalization, signature verification)
  belong in `lib/`, not components. Add tests with them (PRD §19).
- Dates: store UTC, display Asia/Bangkok via helpers in `lib/utils.ts`. Don't call
  `new Date()` for display formatting without a timezone.
- AI never writes to the DB directly. It returns Zod-validated JSON
  (`lib/ai/schemas.ts`); deterministic rules decide what to persist (PRD §16, §23).
- Secrets are server-only. Never import service-role keys or AI keys into client
  components.

## Commands

```bash
npm run dev        # local dev
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm run build      # production build
```

## Next steps (see prd.md §20)

Phase 1 (secure ingestion) → Phase 2 (AI + trip engine) → Phase 3 (wire UI to live
data) → Phase 4 (hardening + pilot). Build one milestone at a time; migrations
before the code that depends on them.
