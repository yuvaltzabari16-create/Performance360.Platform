# Performance360 (v2, Vite + React + Supabase)

Football performance platform for clubs: coach/director app + athlete portal on one Supabase database. Hebrew (RTL, default) and English.
README.md has the full feature list per stage; read it first.

## Commands
- `npm install`, then `npm run dev` (needs `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `npm run typecheck`, `npm run build`
- Demo build (no backend, sample data in localStorage, published as a Claude artifact): `node demo/build.mjs` → `dist-demo/performance360-demo.html`
  - `@supabase/supabase-js` is aliased to `demo/backend.js` (in-memory DB that emulates RLS-relevant triggers and the edge functions). Keep it in sync when adding tables, RPCs or functions.

## Backend
- Supabase project `Performance360-v2` (ref `bheprhssdyladsddalpy`, eu-central-1). Migrations in `supabase/migrations/` are already applied; add new ones, never edit applied ones.
- RLS on every table. Helpers are security-definer SQL functions with `search_path = ''` (`is_staff`, `is_director`, `can_edit_player`, `is_own_player`, …).
- Edge functions: `ai-workout` (Claude, needs `ANTHROPIC_API_KEY` secret), `player-login` (username + PIN accounts via service role).
- Permission tests: `supabase/tests/rls_test.sql` (rolls back; reports via raised exception). Not yet run against the live project.

## Code map
- `src/lib`: session, i18n (`en`/`he` dicts must keep the same keys), router (hash), data loaders, load/readiness math, `playerLogin.ts`
- `src/lib/anim`: illustrated exercise animations. `rig.ts` (2D figure, FK/IK), `draw.ts` + `engine.ts` (SVG + SMIL), `p_*.ts` (movement patterns), `catalog.ts` (exercise → pattern + muscles, keyword rules).
- `src/pages/coach/*`, `src/pages/athlete/*`, `src/components/*`; styles and design tokens in `src/styles.css` (white/green brand, light/dark, RTL-safe).

## Conventions
- All UI text through `useI18n()`; mixed-direction strings use `dir="auto"` / `<bdi>`.
- Test UI changes in both languages, phone width (no horizontal scroll) and dark mode.
- Note: `main` in this repo holds a separate Next.js build of Performance360; this v2 lives on branch `p360-v2-vite`.
