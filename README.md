# Performance360 Platform

Football performance management for clubs and academies — one app for club directors, coaches and athletes, in Hebrew and English.

**Stage 1:** club accounts and roles, squads, player profiles, invite links, athlete daily wellness check-in with a readiness score, coach notes, and a daily readiness overview.

**Stage 2:** weekly training calendar per squad, session RPE from athletes (or entered by staff), training load (sRPE = RPE × minutes) with acute 7-day / chronic 28-day averages and ACWR flags, and physical testing (6 built-in tests, batch result entry, latest vs previous vs best, team trend).

## Stack

- **Frontend:** React 19 + TypeScript + Vite. No UI framework — the design system from the prototype lives in `src/styles.css`.
- **Backend:** Supabase (Postgres + Auth). Project `Performance360-v2` (`bheprhssdyladsddalpy`, eu-central-1).
- **Security:** every table has row-level security; permissions are enforced in the database, not just the UI.
- **Routing:** hash routes (`#/players/…`), so the build runs on any static host with no rewrite rules.

## Run it

```bash
cp .env.example .env      # Supabase URL + publishable key (safe to expose in the browser)
npm install
npm run dev               # http://localhost:5173
npm run build             # type-check + production build into dist/
```

Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, an nginx server).

### Supabase settings to check once

In the Supabase dashboard → Authentication → URL Configuration, set **Site URL** to where the app is hosted and add it (and `http://localhost:5173`) to **Redirect URLs**, so email-confirmation links land back in the app.

## Roles

| | Director | Coach | Athlete |
|---|---|---|---|
| See all club players & check-ins | ✓ | ✓ | own only |
| Add / edit players | any squad | squads they coach | — |
| Create squads, assign coaches | ✓ | — | — |
| Invite coaches | ✓ | — | — |
| Invite athletes | ✓ | own squads | — |
| Coach notes | ✓ | ✓ | sees shared notes |
| Daily check-in | — | — | ✓ (today ±1 day) |

Someone who signs up without an invite creates a club and becomes its director. Coaches and athletes join through one-time invite links (14-day expiry) that a director or coach copies and sends — via WhatsApp, SMS or email.

## Readiness score

Athletes rate sleep quality, energy, muscle freshness, calm and mood on 1–5. Readiness = `(average − 1) / 4 × 100`, computed in the database. Coaches see ≥70 green, 50–69 amber, <50 red; pain reports and non-available status are flagged under "Needs attention".

## Project layout

```
src/
  lib/          supabase client, session & roles, i18n (he/en, RTL), data loaders, router
  components/   app shell, UI primitives, readiness chart
  pages/        Auth, Onboarding, Invite, Settings
  pages/coach/  Overview, Players, PlayerProfile, Squads, Staff
  pages/athlete/Today (check-in), Progress, Notes
supabase/
  migrations/   the exact SQL applied to the database, in order
  tests/        rls_test.sql — permissions test (rolls itself back)
```

## Verifying permissions

Open the Supabase SQL editor, paste `supabase/tests/rls_test.sql`, run it. It creates throwaway users, checks ~30 access rules, and rolls everything back; the error message it ends with is the report — every line should match its "(expect …)" and none should say FAIL.

## Training load

Athletes rate each session on the CR10 scale (0–10) with minutes taken part; they can rate sessions up to 3 days back. Daily load is summed per day. ACWR = mean daily load over 7 days ÷ mean over 28 days; 0.8–1.3 is green, 1.3–1.5 or below 0.8 amber, above 1.5 red and listed under "Needs attention".

## Next stages

3. Workout planner + exercise library (AI-assisted), assignments to athletes
4. Injuries & return-to-play board, messaging, notifications
