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
| Exercise library: 347 system exercises with video links (from the coach-provided list), custom exercises, favorites | Working (live) |
| Training planner: programs → phases → weeks → sessions → exercises, copy/duplicate, templates, versions, assignment, athlete logging, planned vs completed | Working |
| Performance testing: 19 standard tests, custom tests, trials, batteries, trends, CSV export | Working |
| Readiness check-ins with self-referenced review flags | Working |
| Team accounts (director, staff roles, invitations, consented roster; live on the Supabase project since 2026-10-22), training groups, notifications (in-app), settings, JSON data export, account deactivation | Working |
| Workout builder with automatic session builder, training calendar, athlete "Today's workout" | Working (rule-based, runs inside the app, no outside service) |
| Return to play: injury timeline, staff injury board, clearance by qualified roles | Working |
| GPS and wearables: CSV import (StatSports, Catapult, Polar, generic), distance, speed zones, sprints, heat maps | Working (live vendor sync needs vendor API access) |
| Role logins: director (read-only club view), head coach, head of performance, physiotherapist, athlete, personal trainer | Working |
| Messages and file attachments in every category | Working |
| Wearables: WHOOP connection and Fitbit / WHOOP file import, shared with staff only by the athlete's choice | Working (live WHOOP is switched off until WHOOP approves the app, then `WHOOP_LIVE=1`; Fitbit live waits for Google approval) |
| Security and compliance: CSP, https, rate limits, bot guard, two-factor, idle sign-out, account deletion, privacy policy, terms, parental consent for minors | Working (legal texts are a draft until reviewed) |
| Reports/PDF, Google Calendar, payments, nutrition and custom forms, video feed, research library, subscriptions | **Not built yet** |

Documentation: [Contributing](CONTRIBUTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Roles and access](docs/ROLES.md) ·
[Deployment](docs/DEPLOYMENT.md) · [Database](supabase/README.md) · [Decisions](docs/adr) · [Known issues](docs/KNOWN-ISSUES.md) · [Changelog](CHANGELOG.md).
Run all fast checks with `npm run verify`.

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

## Security and compliance

Each concern is its own small module with comments and tests, so it can be changed in isolation.

| Concern | Where | What it does |
| --- | --- | --- |
| Encrypted transport | `src/lib/security/https.ts`, `headers.ts` | Production http requests are redirected to https; HSTS header; `upgrade-insecure-requests` |
| XSS | `src/lib/security/headers.ts`, `url.ts`; eslint `react/no-danger` | Per-request nonce Content-Security-Policy (inline scripts blocked), frame/object/form-action lockdown, safe URL checks, no raw HTML injection allowed |
| SQL / filter injection | `src/lib/security/query.ts` | The Supabase client binds every value as a parameter; search text is additionally stripped of filter syntax and LIKE wildcards |
| Request flooding | `src/lib/security/rate-limit.ts`, `policy.ts` | Per-IP limits, strictest on sign-in/sign-up (429 + Retry-After). In-memory per instance: use a shared store when running several instances |
| Bots | `src/lib/security/bot-guard.ts`, `components/security/BotGuardFields.tsx` | Honeypot, signed time trap, optional Cloudflare Turnstile on login, sign-up and password reset |
| Two-factor sign-in | `settings/security/*`, `(auth)/login/mfa`, `supabase/middleware.ts` | Authenticator-app (TOTP) codes; a password-only session cannot reach the app once 2FA is on |
| Auto sign-out | `components/security/IdleLogout.tsx`, `lib/security/idle.ts` | Warns, then signs out after inactivity (choose Never/15/30/60/120 min in Settings; default 60) |
| Delete account | `supabase/migrations/*_delete_account.sql`, `settings/security/actions.ts` | Permanent deletion after typing the email and password; last-director guard; audited |
| Autosave | `lib/autosave/*`, `components/autosave/*` | Debounced autosave with status, flush on tab hide, and local drafts for unsent notes |
| Payments | `lib/payments/*`, `/billing` | External hosted checkout only; a test fails the build if card fields appear in the source |
| Affiliate disclosure | `lib/legal/affiliate.ts`, `components/legal/ExternalLink.tsx`, `/disclosure` | Affiliate links get `rel="sponsored"` and a visible "Affiliate link" label automatically |
| Font and icon licenses | `src/lib/legal/assets.json`, `scripts/check-licenses.mjs`, `/licenses` | `npm run check:licenses` fails on undeclared fonts/icons or disallowed dependency licenses |
| Accessibility statement | `/accessibility` | Public statement; skip link, visible focus and reduced-motion support in the UI. Fill in the coordinator contact (see `.env.example`) before launch |

Honest limits: the accessibility statement is based on an internal review, not an independent audit; an Israeli
legal statement should be confirmed by a qualified accessibility consultant. Legal pages are product text, not legal advice.

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
