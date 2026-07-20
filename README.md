# LINE Trip Intelligence

Turn informal LINE transport conversations into a traceable, searchable trip
database. See [`prd.md`](./prd.md) for the full product spec.

**Owner:** GEOID (Thailand) Co., Ltd. · **Timezone:** Asia/Bangkok · **Status:** MVP scaffold

---

## What's in this repo right now

This is the **UI-first scaffold** — the operations interface built with realistic
mock data so the look and flow can be reviewed before backend wiring. It ships with
a clean, white "dispatch console" design system.

Screens:

| Route | Screen |
|---|---|
| `/login` | Sign in (split brand + form) |
| `/dashboard` | Stat readouts, active trips, needs-attention, recent updates |
| `/trips` | Filterable / sortable trip table + CSV export (card mode on mobile) |
| `/trips/[id]` | Trip detail: journey rail, event timeline, details, summary, messages, attachments |
| `/reviews` | Review queue with side-by-side source vs. proposed values |
| `/messages` | Raw message inbox with classification + processing status |
| `/settings` | Org, groups, thresholds, AI provider, retention, aliases, users |

Mock data lives in [`lib/mock/data.ts`](./lib/mock/data.ts) and includes the PRD's
`TPL6.5` regression sample. Swap that module for Supabase queries later — the UI
reads only through its accessor functions.

## Design system

- **Palette:** white canvas, hairline borders, one customs-ink green accent
  (`#0F5C4B`). Status hues kept low-chroma. Tokens in `app/globals.css`.
- **Type:** IBM Plex Sans (headings), Plex Sans Thai (body — Thai driver names),
  Plex Mono (every operational identifier: shipment codes, containers, plates).
- **Signature:** the **journey rail** — the trip lifecycle rendered as an honest
  sequence (`components/trips/journey-rail.tsx`).

## Stack

Next.js App Router · TypeScript · Tailwind CSS · Zod · Supabase (planned) ·
AI extraction via **OpenRouter** (`moonshotai/kimi-k3`, configurable).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values as you wire up backends
npm run dev                  # http://localhost:3000
```

Validation:

```bash
npm run typecheck
npm run lint
npm run build
```

## AI provider

Extraction goes through a provider abstraction (`lib/ai/extractor.ts`) so trip
logic never depends on a specific vendor. The initial implementation targets
OpenRouter; set the model with `AI_MODEL` (default `moonshotai/kimi-k3`). All AI
output is validated against a versioned Zod schema (`lib/ai/schemas.ts`) before any
application logic runs.

## Roadmap (from the PRD)

- **Phase 1** — LINE webhook ingestion, signature verification, Supabase schema +
  RLS, private attachment storage, idempotent event/message storage.
- **Phase 2** — AI extraction worker, normalizers, trip matcher/dedup, review-item
  generation.
- **Phase 3** — wire these screens to live data.
- **Phase 4** — RLS/security tests, AI regression set, pilot with one LINE group.
