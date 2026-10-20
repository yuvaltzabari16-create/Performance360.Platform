# Performance360 — engineering report

Branch `hardening/phase-1-security`, based on `base44-import` (commit
`8a84420`, a copy of Base44 app `6abac832c9b011820449e26c`). Date: 2026-10-20.

Status key: **Done+tested** · **Done, untested** · **Partial** · **Blocked** · **Not done**.

## 1. Initial state

A working Base44 prototype (23 pages, 16 entities, 10 functions) branded
“ApexMotion”. The UI covered most of the product vision, but the security
model relied on record fields the browser set itself. Prioritized audit
findings (all confirmed by reading the code):

| # | Severity | Finding |
| --- | --- | --- |
| 1 | Critical | `User.role/coach_id/onboarded` locked with key `update`; Base44’s security docs name the field-level keys `read`/`write`, so the lock may not apply → possible self-promotion to admin |
| 2 | Critical | Create rules for Workout, WorkoutAssignment, PerformanceMetric, Readiness, Milestones, Messages etc. let any user create records naming another user (`user_id`/`coach_id`/`athlete_id` set by the browser; `created_by_id` branch always true on create) |
| 3 | Critical | Athletes could edit their own `Assignment` (link) records directly; messages’ `sender_role` was spoofable |
| 4 | High | Athletes could self-complete rehab clearance and edit coach-prescribed workouts |
| 5 | High | Coach access to athlete data depended on a stored `coach_id` that the client never set and that was never revoked on removal |
| 6 | High | `onboardUser` allowed changing role at any time; `inviteAthlete` did not check team ownership; email comparison was case-sensitive |
| 7 | High | Athlete Management listed all platform users |
| 8 | High | Video analysis fell back to an AI “score” generated without seeing the video |
| 9 | Medium | Planner: athletes never loaded (schedule unusable), infinite loading for coaches with no athlete selected, no delete confirmation, unhandled AI errors, saving a template called `Workout.update` |
| 10 | Medium | `VariableChip` crashed on numeric `sets`; Dashboard AI session wrote a removed `exercises` field; legacy flat-format components |
| 11 | Medium | Dates computed in UTC (`toISOString`) — off by one day for users east of UTC (e.g. Israel after midnight) |
| 12 | Medium | Readiness “score” and radar chart: undocumented formula, mixed units on one axis; averages counted missing values as 0; AI prompt filled missing readiness with invented defaults |
| 13 | Low | Report PDF titled with the coach’s name; internal error text returned to clients; unused modules |

## 2. Architecture

React 18 + Vite + Tailwind + shadcn/ui frontend; `@base44/sdk` client;
Base44 entities with RLS; Deno backend functions using the service role and
`Core.InvokeLLM` / `Core.SendEmail` / file uploads. Unchanged stack.

Added: `base44/shared/` pure modules (validation, policy, metrics catalog,
training, overview, entitlements) imported by functions and, for the metric
catalog, by the frontend. Security model: `docs/SECURITY_MODEL.md`.

## 3. Features implemented

| Area | Change | Status |
| --- | --- | --- |
| Coach–athlete connection | Invite (validated, team-owned, duplicate-safe, 14-day expiry), accept/decline (case-insensitive), revoke pending, remove athlete, athlete can leave; revocation clears access | Done+tested (functions) |
| Athletes page | Coach’s own roster only, invite form, revoke/remove with confirmation, past connections | Done, untested (UI) |
| Training | Coach library vs athlete copies; `assignWorkout` copies to linked athletes/teams; `completeWorkout` stores athlete results separately from the prescription; completed sessions locked | Done+tested (functions) |
| Planner | Fixed defects in #9, read-only states, AI errors shown, templates handled correctly | Done, untested (UI) |
| Performance testing | 21-test catalog (5/10/20/30 m sprint, CMJ, SJ, DJ, single-leg CMJ, 1RMs, IMTP, 505, pro-agility, Yo-Yo IR1, 30-15 IFT, RSA, mobility) with units, protocols, plausibility bounds, sides; history kept; change vs athlete’s own previous result; RSI and RSA decrement formulas | Done+tested (logic) |
| Wellness | Optional fields, nothing pre-filled, one per day, no composite score; 7-day session load (sRPE × min) only from logged data | Done+tested (logic) |
| Return-to-play | Coach-authored plans (no seeded clinical template), phase start/clear/reopen, clearance requires a named professional, athletes tick exercises only | Done+tested (functions) |
| Messages | New page; `sendMessage` checks the link, derives sender; read receipts; 15 s polling (no push/email) | Done+tested (functions) |
| Dashboards | Coach: roster summary, adherence, rule-based follow-up prompts (`coachOverview`). Athlete: today, 28-day completion, unlogged sessions | Done+tested (logic) |
| Reports | PDF uses only authorized data, correct athlete name, 28-day adherence, clearance recorder | Done, untested |
| Video analysis | Server-created records, private file kept, no fabricated fallback, no score | Done+tested (functions) |
| Navigation/branding | Performance360 name, role-based menu, mobile bottom bar + “More” sheet | Done, untested |
| Subscriptions | Plan model without prices, `Subscription` entity, opt-in limit check | Partial |
| Club admin, platform admin console, athlete-invites-coach, notifications (email/push), dark design system | — | Not done |

## 4. Security improvements

Findings 1–8 and 13 addressed: server-only writes for every cross-user
entity; coach reads through `athleteData` (link checked per call); role
locked after onboarding; field locks set with both keys; derived sender
roles; revocation on removal; generic error messages; AI input caps; no
invented AI outputs. Details and residual risks: `docs/SECURITY_MODEL.md`.

## 5. UI/UX improvements

Loading, empty and error states on every rewritten page; confirmations for
destructive actions; labelled form controls and icon buttons; tables wrap in
horizontal scrollers; calendar scrolls on phones; clear “AI draft” and
“not a medical assessment” labelling. The broader dark visual redesign from
the brief was **not** done: it needs visual review in a running app, which
was not possible here.

## 6. Files changed

87 files: 14 entities, 15 functions (6 new), 7 shared modules (6 new), 26
frontend files (1 new page, 1 new lib; 5 dead files removed after confirming
no imports), 7 test files, 3 docs, `package.json` (`test` script),
`bunfig.toml`. See `git diff 8a84420 --stat`.

## 7. Schema changes

Additive; listed with migration notes and rollback in
`docs/LAUNCH_CHECKLIST.md` §2. **Not applied to any Base44 app.**

## 8. Tests executed

| Command | Result |
| --- | --- |
| `bun test` (Bun 1.4.2) | **77 pass, 0 fail**, 413 assertions, 4 files |
| Mutation check: broke two rules on purpose | 3 tests failed as expected; rules restored; suite green |
| `bun build src/main.jsx --packages external` | 82 modules bundled, no errors (Tailwind directives warn, expected) |
| `bun build` of the 5 AI functions | all compiled |
| TypeScript pass (allowJs) filtered for unknown names / unresolved local imports | 0 |
| Syntax + import scan of 126 source files | 0 errors, all local imports resolve |

Not run: `npm install`, `npm run build`, `npm run lint`, `npm run
typecheck` (npm registry blocked in this session); any browser/UI test; any
test against Base44’s real RLS. Manual RLS checklist: `docs/TESTING.md`.

## 9. Build and type-check

Vite build **not run** (see above). The Bun bundle is evidence that every JSX
module compiles and resolves; it is not a substitute for `npm run build`.

## 10. Base44 ↔ GitHub

Not connected. One-way manual copy; GitHub integration returned 402 on the
current plan; builder message quota exhausted; no deployment was made. Exact
routes: `docs/LAUNCH_CHECKLIST.md` §1.

## 11. Payments

Not configured. No provider, no prices, no webhook. Entitlement checks are
off unless `ENFORCE_ENTITLEMENTS=true`.

## 12. Known limitations and bugs

* RLS semantics unverified on the platform (`docs/TESTING.md`).
* Coaches cannot edit a session after scheduling it (by design for now —
  needs an `updateAssignedWorkout` function that refuses completed sessions).
* Profile photos are public files; upload checks are client-side.
* Messages poll every 15 s; no email/push notifications.
* AI program generation is capped at 4 weeks × 3 sessions (pre-existing).
* Pre-existing pages not reworked: Exercise Library, Video Feed, Knowledge,
  AI Assistant, auth pages.

## 13. External configuration needed

Base44 plan with GitHub integration or CLI deploy access; access to the app
behind the live URL; email sending verification; payment provider; domain;
legal documents.

## 14. Launch blockers

1. Code not deployed to Base44; live app identity unconfirmed.
2. Platform RLS checks (`docs/TESTING.md`) not run.
3. `npm run build`/lint not run.
4. No UI verification on phone/tablet/desktop.
5. Legal/consent decisions (minors, health data).
6. Payments, if launching paid plans.

## 15. Next steps

1. Run `npm install && npm run build && npm run lint && bun test` locally.
2. Deploy this branch to a **test** Base44 app (`base44 link` → `base44
   deploy`) and run every `docs/TESTING.md` row; fix anything that fails.
3. Confirm which app serves the live URL; back it up; then deploy there.
4. Delete the builder’s test invitation (`6ad77ab67bf61027a7e8a8db`).
5. Add `updateAssignedWorkout`; club admin role; email notifications.
6. Decide plans/prices; implement provider checkout + verified webhook.
7. Visual design pass with screenshots at 375/768/1280 px.
