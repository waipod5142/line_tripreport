# LINE Message Archive

Capture messages from LINE transport group chats into a searchable, per-group
record you can export to CSV.

**Owner:** GEOID (Thailand) Co., Ltd. · **Timezone:** Asia/Bangkok

> This project began as "LINE Trip Intelligence" — an AI pipeline that turned chat
> messages into structured trip records. That product was **removed on 17 Aug 2026**.
> [`prd.md`](./prd.md) is retained as the historical spec; it is no longer what the
> code does. See [`CLAUDE.md`](./CLAUDE.md) for the current architecture.

---

## What it does

```
LINE group chat → webhook (signature-verified, idempotent) → Postgres + private
attachment storage → per-group inbox → CSV export
```

Screens:

| Route | Screen |
|---|---|
| `/login` | Sign in — Google OAuth or email magic link, allowlist-gated |
| `/messages` | Message inbox: search, filter by group / type / status, CSV export |
| `/settings` | Approve or pause the LINE groups this workspace captures |

## Adding a LINE group

Groups are allowlisted — the bot does not capture a chat just because it was added
to it.

1. Invite the LINE official account to the group chat.
2. It registers itself under **Settings → LINE groups** as `pending` within seconds.
3. Press **Approve**. Messages start landing in the inbox immediately, and the group
   becomes selectable in the inbox filter and the export.

Messages sent while a group is still `pending` are **discarded** — the raw webhook
event is retained in `webhook_events`, but no message row is created. Approve a
group before you need its history.

## Export

The CSV is defined as *everything matching the filters currently in the URL*, not
what the page happened to load — so filter to a group, then export, and you get that
group's full history streamed straight to disk. Files are named for the group and
dated in Bangkok time: `messages-hi-tech-logistics-2026-08-17.csv`.

## Design system

- **Palette:** white canvas, hairline borders, one customs-ink green accent
  (`#0F5C4B`). Status hues kept low-chroma. Tokens in `app/globals.css`.
- **Type:** IBM Plex Sans (headings), Plex Sans Thai (body — Thai sender names),
  Plex Mono (every operational identifier: group ids, timestamps, filenames).

## Stack

Next.js App Router · TypeScript · React 19 · Tailwind CSS · Zod ·
Supabase (Postgres + RLS, Auth, private Storage) · Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + LINE credentials
npm run dev                  # http://localhost:3000
```

Validation:

```bash
npm test        # vitest
npm run typecheck
npm run lint
npm run build
```
