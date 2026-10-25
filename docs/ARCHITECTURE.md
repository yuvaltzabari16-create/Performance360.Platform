# Architecture

Performance360 is a Next.js 15 (App Router, server actions, TypeScript, Tailwind 4) application on Supabase
(Postgres, Auth). English and Hebrew (right-to-left) are supported everywhere.

## Layers

```
Browser ── middleware (CSP nonce, https, rate limit, session refresh, 2FA check)
   │
   ▼
src/app/**           pages and server actions        thin: validate input, call the database, redirect
src/components/**    reusable UI (server components by default; "use client" only where needed)
src/lib/**           pure logic and helpers          no UI, no database; covered by unit tests
   │
   ▼
Supabase             Postgres with row-level security (RLS) and SECURITY DEFINER functions
```

Rules of thumb

- **The database is the authority.** Menus and page guards (`src/lib/permissions.ts`) are the front door;
  every rule that matters is also enforced by RLS or a function (see ADR 0002 and `docs/ROLES.md`).
- **Writes with business rules go through functions** (`report_injury`, `import_gps_session`,
  `add_attachment`, `send_message` …): they check who may act, validate, write an audit entry and notify.
  Tables are read-only to the `authenticated` role for such data.
- **Small, named modules.** One concern per file; shared pieces live in `src/lib/<area>` and
  `src/components/<area>`. A page file composes components; it does not contain business rules.
- **No invented data.** Numbers on screen are counted from rows. Sample data is always labelled.

## Code map

| Area | Pages / actions | Logic (`src/lib`) | Components |
| --- | --- | --- | --- |
| Roles and menus | `(app)/layout.tsx`, `login` | `permissions.ts`, `permissions-matrix.ts`, `login-roles.ts` | `shell/` |
| Training planner and builder | `(app)/training` | `builder-fields.ts`, `catalog.ts`, `ai/` | `training/` |
| Calendar and today view | `(app)/calendar`, `dashboard` | `calendar.ts` | `calendar/` |
| Testing and readiness | `(app)/testing`, `readiness` | `metrics.ts` | `charts/` |
| Injuries and return to play | `(app)/injuries`, athlete page | `injury.ts`, `injury-data.ts` | `injury/` |
| GPS and wearables | `(app)/gps` | `gps/` (csv, samples, summary, metrics, demo) | `gps/` |
| Messages and files | `(app)/messages`, `app/files` | `files/` | `files/` |
| Teams and roster | `(app)/team`, `teams`, `connect`, `code` | `types.ts` | |
| Security | `middleware.ts`, `(auth)` | `security/` | `security/` |
| Legal and consent | `privacy`, `terms`, `accessibility`, `disclosure`, `licenses` | `legal/`, `minors.ts` | `legal/` |
| Settings and privacy | `(app)/settings` | `autosave/` | `autosave/` |

## Data model (main tables)

`profiles` (account + role) · `athletes` (+ guardian consent) · `coach_athlete_relationships` ·
`organizations`, `organization_members` (team role), `organization_athletes` (consented roster) ·
`training_programs → program_phases → training_sessions → session_exercises`, `program_assignments`,
`workout_completions` · `test_definitions`, `test_results` · `readiness_entries` ·
`injuries`, `injury_events` (append-only) · `gps_sessions`, `gps_session_metrics` ·
`direct_messages` · `attachments` · `notifications`, `audit_log`.

Access helpers used by policies: `can_access_athlete`, `is_athlete_professional`, `is_primary_coach`,
`is_own_athlete_record`, `director_sees_athlete`, `can_view_gps`, `can_view_attachment`.

## Testing

| Level | Command | What it proves |
| --- | --- | --- |
| Unit | `npm test` | pure logic, parsers, permissions matrix, docs in sync |
| Database | `npm run test:db` | every migration applies on a clean database; RLS and functions allow and deny the right people |
| End to end | `npx playwright test` (needs the local stack) | real flows per role in a browser, English and Hebrew |
| All fast checks | `npm run verify` | lint, types, unit, licenses, database |

CI (`.github/workflows/ci.yml`) runs the fast checks and the build on every pull request.
