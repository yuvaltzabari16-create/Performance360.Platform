# Contributing

## Setup

```bash
nvm use                  # Node 20+ (.nvmrc)
npm ci
cp .env.example .env.local   # fill in your Supabase project
npm run dev
```

PostgreSQL 16 binaries are needed for `npm run test:db` (`PGBIN` points at them; default `/usr/lib/postgresql/16/bin`).

## Daily workflow

1. Branch from `main`: `feature/<topic>`, `fix/<topic>`, `docs/<topic>`.
2. Small commits with a clear imperative subject ("Add GPS import for physiotherapists") and a body that explains the *why*.
3. Before pushing: `npm run verify` (lint, types, unit tests, license check, SQL tests).
4. Open a pull request using the template. CI must be green. One approving review before merge; squash or rebase merge.
5. Never push directly to `main`; never force-push a shared branch.

## Definition of done

- Behavior is covered by a test at the right level (unit → SQL → e2e).
- Access rules are enforced in the database and proven by a SQL test (see `docs/adr/0002`).
- Text exists in English and Hebrew, checked in RTL; the page works at phone width.
- Accessibility basics hold: labels on inputs, visible focus, headings in order, no colour-only meaning.
- Docs are updated: `docs/ROLES.md` (run `npm run docs:roles`), `.env.example`, `docs/DEPLOYMENT.md`, `CHANGELOG.md`.

## Database changes

- New file in `supabase/migrations` named `YYYYMMDDHHMMSS_topic.sql`; applied migrations are immutable.
- RLS on every table, `security definer` functions with a pinned `search_path`, grants only to what the app calls.
- Statements containing `DELETE` are listed in `supabase/manual/` as well, because the assistant's database
  connection cannot confirm them (see `supabase/README.md`).
- Apply to the live project only after `npm run test:db` passes, one migration at a time, then record it in
  the status table in `supabase/README.md`.

## Code style

- TypeScript strict; no `any` without a comment explaining why.
- Server components by default; `"use client"` only for real interactivity.
- Pages compose; logic lives in `src/lib/<area>` (pure and tested) and components in `src/components/<area>`.
- Server actions validate input (`src/lib/forms.ts`), call the database, then redirect with a message.
- Comments explain *why* and the domain rule, not what the code says.
- No invented numbers or fake data in the product; sample data is labelled.

## Security

- Never commit secrets (`.env*` is ignored except `.env.example`).
- Report vulnerabilities privately to the operator (see `/privacy` contact), not in public issues.
- Dependency changes: `npm run check:licenses` must pass; review `npm audit` and `docs/KNOWN-ISSUES.md`.
