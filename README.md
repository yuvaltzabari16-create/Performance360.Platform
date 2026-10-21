# Performance360 Platform

Football performance management for clubs and academies — one app for club directors, coaches and athletes, in Hebrew and English.

**Stage 1:** club accounts and roles, squads, player profiles, invite links, athlete daily wellness check-in with a readiness score, coach notes, and a daily readiness overview.

**Stage 2:** weekly training calendar per squad, session RPE from athletes (or entered by staff), training load (sRPE = RPE × minutes) with acute 7-day / chronic 28-day averages and ACWR flags, and physical testing (6 built-in tests, batch result entry, latest vs previous vs best, team trend).

**Stage 3:** exercise library (348 exercises from the club's PDF, each with its YouTube demo; club exercises can be added), a three-pane workout planner (saved workouts · editor with sections, supersets/circuits, editable set fields and coaching notes · AI assistant), assigning a workout to a squad or one athlete, and an athlete workout view to tick sets, log reps/load, finish and rate it.

**Stage 4:** injuries and a six-step return-to-play board (rest → rehab → running → modified training → full training → cleared) with a timeline of every stage change, coach–athlete messaging, in-app notifications (new messages, injuries, stage changes, assigned workouts, pain reported in check-ins), a month view of the training calendar, Hebrew names for the whole exercise library, and a Hebrew/English switch in the top bar.

## Injuries & return to play

Staff who can edit a player log injuries (area, side, type, mechanism, severity, expected return). Moving an injury through the stages is logged automatically, and the player's availability follows their open injuries: rest/rehab → injured, running/modified → rehab, full training/cleared → available. Athletes see their own stage and expected return on Today. Notifications are created by database triggers, so they also fire for changes made outside the app.

## Exercise movement demos
Every exercise has an illustrated, looping demo in the brand colours with the working muscles highlighted (library cards, exercise detail, planner, athlete workout). They are generated in the browser, with no video files and no network:
- `src/lib/anim/rig.ts`: jointed 2D figure (side and front views), forward + 2-bone inverse kinematics, pose interpolation.
- `src/lib/anim/draw.ts` + `engine.ts`: body and muscle shapes; frames combined into one SVG with SMIL animation (plays as an `<img>` or inline, pausable).
- `src/lib/anim/p_*.ts`: ~70 movement patterns with variants (load, single-leg, isometric, machine, band, etc.). `props.ts` draws the equipment.
- `src/lib/anim/catalog.ts`: keyword rules mapping category + name + equipment to a pattern and muscles. Club-added exercises get a demo automatically (category fallback when no rule matches).
The YouTube video, when there is one, stays available under "Real video". Colours follow the `--an-*` CSS variables, including dark mode; `prefers-reduced-motion` starts the demo paused.

## AI workout assistant

The assistant runs as the Supabase edge function `ai-workout` (`supabase/functions/ai-workout`). It uses Claude Sonnet 5.5 with structured JSON output and may only use exercises from the club's library. It can also take a squad's readiness and availability into account. Only staff can call it; it is limited to 100 requests per club per day (usage is logged in `ai_usage`).

**To switch it on:** Supabase dashboard → Edge Functions → Secrets → add `ANTHROPIC_API_KEY` (from console.anthropic.com). Until then the panel shows "AI isn't switched on yet".

## Demo artifact

`node demo/build.mjs` builds `dist-demo/performance360-demo.html`, the same app with a built-in demo backend (`demo/backend.js`: a sample club saved in the browser, a director/coach/athlete switcher, and the AI assistant answered by Claude inside claude.ai). It is published as the Performance360 artifact. Production users still go through Supabase.

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
  pages/athlete/Today (check-in, return to play), Progress, Notes, Workout
  pages/        Messages (coach + athlete), coach/Injuries (RTP board)
supabase/
  migrations/   the exact SQL applied to the database, in order
  tests/        rls_test.sql — permissions test (rolls itself back)
```

## Verifying permissions

Open the Supabase SQL editor, paste `supabase/tests/rls_test.sql`, run it. It creates throwaway users, checks ~30 access rules, and rolls everything back; the error message it ends with is the report — every line should match its "(expect …)" and none should say FAIL.

## Training load

Athletes rate each session on the CR10 scale (0–10) with minutes taken part; they can rate sessions up to 3 days back. Daily load is summed per day. ACWR = mean daily load over 7 days ÷ mean over 28 days; 0.8–1.3 is green, 1.3–1.5 or below 0.8 amber, above 1.5 red and listed under "Needs attention".

## Next stages

5. Reports & exports (squad PDF/CSV), parent access, push/email notifications, movement analysis
