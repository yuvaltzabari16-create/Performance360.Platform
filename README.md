# Academy360

Academy management for a sports academy's staff and athletes, built on the Performance360 platform.
The academy name you enter at sign-up is shown throughout the app; "Academy360" is the product name.

Built with Next.js 15 (App Router, server actions), TypeScript, Tailwind CSS 4
and Supabase (Postgres, Auth). English and Hebrew (RTL) are supported.

## What the academy gets

| Area | What it does |
| --- | --- |
| **Dashboard** | Per role: staff see athletes, active programs, sessions logged, tests this month, programs starting soon and recent tests; the director sees academy totals, staff and roster; athletes see today's workout, upcoming sessions, goals, results and coach feedback |
| **My Athletes** | Profiles, goals, notes shared or private, files, parental consent for minors, search and archive |
| **AI Assistant** | Full-page chat (also a floating button on every page). Role-specific knowledge base in English and Hebrew, including academy topics: development pathways across age groups, season testing plans, youth training, and how to use the app. Runs inside the app, no outside AI service, nothing typed leaves it |
| **Training Calendar** | Every planned session by date, from each program's start date; athletes open and log sessions from it |
| **Messages** | One-to-one messages with file attachments between people who work together |
| **Staff** | The director invites staff with single-use invitations that fix their role, shares the academy code with athletes, manages the roster and splits it into squads |
| **Workout Planner** | Programs → weeks → sessions → exercises, templates, copy, versions, assignment, automatic session builder, planned versus completed |
| **Exercise Library** | 347 exercises with video, custom exercises, favorites, video feed |
| **Testing** | 19 standard tests, custom tests, trials, batteries, trends and CSV export |

The other Performance360 modules (groups, readiness check-ins, injuries and return to play, GPS, wearables, the
personal coach code and the independent personal-trainer account) are still in the code base but closed in
`src/lib/permissions.ts`: they are not in any menu and their pages redirect. Reopening one is a one-line change
there (and `npm run docs:roles`).

Documentation: [Contributing](CONTRIBUTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Roles and access](docs/ROLES.md) ·
[Deployment](docs/DEPLOYMENT.md) · [Database](supabase/README.md) · [Decisions](docs/adr) · [Known issues](docs/KNOWN-ISSUES.md) · [Changelog](CHANGELOG.md).
Run all fast checks with `npm run verify`.

There are no fake metrics. Every dashboard number is counted from database rows,
and no normative values are shown.

## Account types

Sign-up offers two paths (`/` and `/onboarding`):

| Account | Who | What they get |
| --- | --- | --- |
| **Academy** | The academy's director | Creates the academy and becomes its **director**. The academy gets an athlete code (`TEAM-XXXXXX`). The director invites each staff member with a single-use, 14-day invitation (`STAFF-XXXXXX`) that fixes their role: head coach, head of performance, assistant coach, physiotherapist, sports scientist or other staff. Everyone has their own login. |
| **Athlete** | The person being coached | Joins the academy roster with the academy code after seeing which academy it is, and can leave at any time. |

Staff (everyone except the director) work with the athletes on the academy roster; head coach and head of performance
can also edit and archive athlete profiles. The **director runs the academy and reads athlete data read-only**; building
programs and recording tests is the coaching staff's job (the database enforces this). Roster membership needs the
athlete's own consent; staff can add an athlete who has no account yet, and that assertion is recorded. A removed
member or a departing athlete loses access immediately.

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

Academy360 needs **its own Supabase project** (do not point it at the Performance360 project: the two apps
would share users and data). Create one, apply every file in `supabase/migrations` in order, and set its URL and
publishable key in `.env.local` and in the hosting provider. The database schema is the same as Performance360's,
so fixes there can be brought over with `git pull performance360 main`.

## Tests

| Command | What it checks |
| --- | --- |
| `npm run test` | Unit tests for metrics, form parsing and video embedding (Vitest) |
| `npm run test:db` | Applies all migrations to a throwaway local Postgres and runs the RLS/permission, training-function and team-permission suites in `supabase/sql-tests` (needs Postgres 16 binaries) |
| `npx playwright test` | End-to-end flows against a running app + Supabase (`E2E_BASE_URL`): coach onboarding, invitation and connection, program building and assignment, testing, athlete logging and readiness, cross-coach isolation, account types, team roles and roster consent, Hebrew RTL, mobile menu |
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
