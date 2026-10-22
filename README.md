# Performance360

Athletic performance management for coaches, practitioners and athletes:
**Assess → Plan → Train → Monitor → Analyze → Adapt → Perform.**

Built with Next.js 15 (App Router, server actions), TypeScript, Tailwind CSS 4
and Supabase (Postgres, Auth). English and Hebrew (RTL) are supported.

## Status: Phase 1 core (plus parts of Phase 2)

| Module | State |
| --- | --- |
| Auth: sign up, sign in, password reset, sign out | Working (reset emails need SMTP configured in Supabase) |
| Role onboarding (7 roles), enforced in the database | Working |
| Athlete management: profiles, search/filter, archive, notes, flags | Working |
| Personal coach codes, invitation links, confirmed connect, coach transfer | Working |
| Exercise library: 45 system exercises, custom exercises, favorites, video links | Working |
| Training planner: programs → phases → weeks → sessions → exercises, copy/duplicate, templates, versions, assignment, athlete logging, planned vs completed | Working |
| Performance testing: 19 standard tests, custom tests, trials, batteries, trends, CSV export | Working |
| Readiness check-ins with self-referenced review flags | Working |
| Team accounts (director, staff roles, invitations, consented roster), training groups, notifications (in-app), settings, JSON data export, account deactivation | Working |
| AI assistant, reports/PDF, calendar and Google Calendar, payments, nutrition and custom forms, rehab module, video feed, research library, organizations, subscriptions | **Not built yet** (Phases 3–5) |

There are no fake metrics. Every dashboard number is counted from database rows,
and no normative values are shown.

## Account types

Sign-up offers three paths (`/` and `/onboarding`):

| Account | Who | What they get |
| --- | --- | --- |
| **Team** | A club or staff group | The creator becomes the **director** and the team gets an athlete code (`TEAM-XXXXXX`). The director invites each staff member with a single-use, 14-day invitation (`STAFF-XXXXXX`) that fixes their role: head coach, head of performance, assistant coach, physiotherapist, sports scientist or other staff. Everyone has their own login. |
| **Personal Trainer** | An independent practitioner | Own roster, personal coach code (`P360-XXXXXX`) and programs. Can choose a profession (personal trainer, S&C coach, performance coach, physiotherapist, sports scientist). |
| **Athlete** | The person being coached | Connects to a coach (`P360-`) or joins a team roster (`TEAM-`) after seeing who they are connecting with. Can leave at any time. |

Team permissions: staff (everyone except the director) work with the athletes on the team roster; head coach and
head of performance can also edit and archive athlete profiles. The **director sees the roster list and aggregated
totals only, never individual athlete records.** Roster membership needs the athlete's own consent; staff can add an
athlete who has no account yet, and that assertion is recorded. A removed member or a departing athlete loses access
immediately.

## Security model

Authorization lives in Postgres row level security, not in the UI:

- Every table has RLS enabled. Pages and server actions query as the signed-in user.
- Coaches see an athlete only through an **active coach–athlete relationship**.
  Team membership never grants access by itself.
- Relationships are created only by `SECURITY DEFINER` functions: creating an athlete,
  or `connect_with_coach_code`, which requires the athlete to be signed in and to confirm.
- Roles are set once by `complete_onboarding`. The `role` and `is_platform_admin`
  columns are not writable by users.
- Codes are invitations, not credentials. Regenerating a code keeps existing connections.
- Sensitive actions (connections, code changes, assignments, onboarding) are written to `audit_log`.

## Getting started

```bash
npm install
cp .env.example .env.local      # fill in your Supabase URL + publishable key
# apply supabase/migrations/*.sql to your project (Supabase CLI: `supabase db push`)
npm run dev
```

In Supabase Auth settings, set the Site URL to your deployed domain and add
`<site>/auth/callback` to the redirect URLs.

The Supabase project `Performance360` (`https://ioimovfpzgohjzwkshev.supabase.co`)
already has all migrations in `supabase/migrations` applied. Migration file names
match the project's migration history, so `supabase db push` only sends new ones.

## Tests

| Command | What it checks |
| --- | --- |
| `npm run test` | Unit tests for metrics, form parsing and video embedding (Vitest) |
| `npm run test:db` | Applies all migrations to a throwaway local Postgres and runs the RLS/permission, training-function and team-permission suites in `supabase/sql-tests` (needs Postgres 16 binaries) |
| `npx playwright test` | End-to-end flows against a running app + Supabase (`E2E_BASE_URL`): coach onboarding, invitation and connection, program building and assignment, testing, athlete logging and readiness, cross-coach isolation, the three account types, team roles and roster consent, Hebrew RTL, mobile menu |
| `npm run lint`, `npm run typecheck` | ESLint, TypeScript |

## Project layout

```
src/app/(auth)        sign in / sign up / password reset
src/app/(app)         authenticated app (dashboard, athletes, training, testing, …)
src/app/onboarding    role selection
src/lib               auth guards, i18n (en/he), metrics, units, form helpers
src/components        UI kit, app shell, charts
supabase/migrations   schema, RLS, functions, reference data
supabase/sql-tests    database permission tests
e2e                   Playwright end-to-end tests
```

## Notes

- There is intentionally no `loading.tsx` in the `(app)` group: with one, server-action redirects
  hung in Next.js 15.5 in our testing. Buttons show pending states instead.
- Measurements are stored in metric units and converted for display.
