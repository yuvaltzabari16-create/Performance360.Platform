# Testing Performance360

## Automated tests (run in this repository)

```bash
bun test          # or: npm test   (needs Bun ≥ 1.1; no npm packages required)
```

| File | What it covers |
| --- | --- |
| `tests/shared.test.ts` | Pure rules in `base44/shared/`: validation, role/onboarding decisions, invitation and relationship rules, training completion, test-catalog validation and formulas, rehab transitions, coach-overview flags, entitlements. |
| `tests/functions.test.ts` | The real backend function handlers, run with several users (two coaches, two athletes, an admin) against an in-memory fake of the Base44 service role (`tests/fake-sdk.ts`). Checks cross-user isolation, the invitation lifecycle, revocation, scheduling, completion, data entry, messaging, rehab and video analysis. |
| `tests/ai.test.ts` | AI function input limits, no invented readiness defaults, no leaking of internal errors or athlete data into prompts. |
| `tests/rls.test.ts` | Static checks that `base44/entities/*.jsonc` rules are written as intended (server-only writes, no coach_id reads of athlete health/performance data, locked User fields). |

### What these tests do **not** prove

* **Entity RLS behaviour on Base44.** The fake SDK models only the service role. Whether Base44 evaluates the rules the way they are written (for example `$nor`, field-level `write` vs `update`, whether `update` rules check the new data) can only be confirmed on a deployed app — see the manual checks below.
* **The UI.** No browser test ran. The frontend was checked by bundling every module with Bun (`bun build src/main.jsx --packages external`), a syntax/import scan of every file, and a TypeScript pass for unknown identifiers and unresolved local imports. `npm install`, `npm run build` and `npm run lint` could not be run in the session that made these changes (npm registry blocked).

## Manual verification on a Base44 **test** app (required before launch)

Use a separate Base44 app or `base44 dev` (local, in-memory data), never production. Create four accounts: Coach A, Coach B, Athlete 1, Athlete 2. Coach A invites Athlete 1; Athlete 1 accepts.

Use the browser console (`base44` SDK on the page) or the API to attempt each action as the named user. Every “must fail” row must return 403/empty results.

| # | As | Attempt | Expected |
| --- | --- | --- | --- |
| 1 | Athlete 1 | `base44.auth.updateMe({ role: 'admin' })`, then `({ role: 'coach' })`, `({ coach_id: 'x' })`, `({ onboarded: false })` | Refused or ignored; role unchanged |
| 2 | Athlete 1 | `entities.PerformanceMetric.create({ user_id: <Athlete 2 id>, ... })` | 403 |
| 3 | Athlete 1 | `entities.Workout.create({ user_id: <Athlete 2 id>, title: 'x' })` | 403 |
| 4 | Athlete 1 | Create own workout, then `Workout.update(id, { user_id: <Athlete 2 id> })` | 403 (if this succeeds, record it as a residual risk) |
| 5 | Coach B | `entities.PerformanceMetric.filter({ user_id: <Athlete 1 id> })` | empty |
| 6 | Coach B | `functions.invoke('athleteData', { athlete_id: <Athlete 1 id>, entity: 'ReadinessEntry' })` | 403 |
| 7 | Coach A | Same as 6 | 200 with Athlete 1’s data |
| 8 | Athlete 1 | `entities.Assignment.update(<link id>, { status: 'active', coach_id: <Coach B id> })` | 403 |
| 9 | Athlete 1 | `entities.CollaborationMessage.create({ athlete_id, coach_id, sender_id, sender_role: 'coach', content })` | 403 |
| 10 | Athlete 1 | `entities.ClearanceMilestone.update(<id>, { status: 'completed' })` | 403 |
| 11 | Athlete 1 | `entities.Workout.update(<coach-assigned copy id>, { blocks: [] })` | 403 |
| 12 | Coach A | Remove Athlete 1, then repeat 7 and read the prescribed workouts | 403 / not visible |
| 13 | Anyone | Knowledge Base page | Admin articles visible; another coach’s private saved research not visible |
| 14 | Athlete 2 | `entities.TeamMember.create({ team_id: <Coach A team>, user_id: <self>, role: 'athlete' })` | 403 |
| 15 | Coach A | Profile/Dashboard/Planner/Performance/Wellness/Rehab/Messages on a 375 px wide screen | No horizontal page scroll; all actions reachable |

Record the outcome of each row (pass/fail, date, tester) before launch.
