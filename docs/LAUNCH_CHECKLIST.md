# Launch checklist

Nothing below has been done in production. Items marked **decision** need the
owner; items marked **verify** need a person with access to Base44.

## 1. Get this code into Base44 (blocker)

This repository is **not** connected to Base44. It is a one-way copy of app
`6abac832c9b011820449e26c`, read through the Base44 code API. Pushing here
changes nothing in Base44, and Base44 edits do not appear here. (The README’s
“changes pushed to the repo are reflected in the Builder” line is Base44
template text that only applies once the GitHub integration is connected.)

Supported routes, in order of preference:

1. **Connect Base44’s GitHub integration** (returned HTTP 402 on the current
   plan — needs a plan that includes it). Check Base44’s docs for whether it
   can attach to this existing repository or needs a fresh one, then publish
   from the dashboard as the README describes.
2. **Base44 CLI to a test app first**: `npm i -g base44@latest`,
   `base44 login`, `base44 link` (to a *test* app), `base44 deploy`. Run
   `docs/TESTING.md` manual checks there. Only then link and deploy to the
   real app. A CLI deploy overwrites the app’s entities, functions and site
   with this tree — export or checkpoint the current app first.
3. **verify** which app serves `performance360platform.base44.app`. It
   appears to be a different app (`6abad038…`) than the one copied here, and
   that app was not accessible to this session.

## 2. Schema changes to apply (additive)

All changes add fields or enum values; none remove or rename stored data
except `MovementAnalysis.score`, which is dropped from the schema (existing
values stay in stored records but are no longer shown — AI scores had no
validated basis).

| Entity | Change |
| --- | --- |
| Assignment | + `revoked` status; + `responded_at`, `ended_at`, `ended_by_id`; writes server-only |
| Workout | + `owner_scope`, `source_workout_id`, `prescribed_by_id`, `completed_at`, `athlete_result`; create only for self |
| WorkoutAssignment | + `source_workout_id`, `status`, `completed_at`; writes server-only |
| PerformanceMetric | + categories (power, change_of_direction, repeated_sprint); + `metric_key`, `side`, `notes`, `recorded_by_id`, `source`; server-only writes; coach reads via function |
| ReadinessEntry | + `recorded_by_id`, `source`; server-only writes |
| ClearanceMilestone | + `cleared_by_name`, `clearance_note`, `cleared_at`, `recorded_by_id`; server-only writes |
| ExerciseBlock | + `completed_at`; server-only writes |
| CollaborationMessage | + `sender_name`, `read_at`; server-only writes |
| KnowledgeArticle | + `visibility` (public/private); coaches may save private research |
| TeamMember / Team | membership writes server-only; team creation needs coach role |
| User | + `coach_type`, `position`, `age_group`; privileged fields locked with `write` and `update` |
| Subscription | new, admin-only writes |

**Existing data**: records created before this change keep working, but
(a) existing `PerformanceMetric`/`ReadinessEntry` rows that were created with a
coach’s id in `user_id` stay with that user; (b) the builder’s test
invitation to `test@example.com` (`6ad77ab67bf61027a7e8a8db`) should be
removed. No migration script was run.

**Rollback**: redeploy the previous tree (commit `8a84420` on branch
`base44-import`). Because schema changes are additive, rolling back does not
lose new fields’ data, but the old rules reopen the documented holes.

## 3. Configuration and secrets

| Item | Where | Status |
| --- | --- | --- |
| `ENFORCE_ENTITLEMENTS` | Base44 function secrets | Leave unset until billing works |
| Email sending (`Core.SendEmail`) | Base44 | **verify** — invite emails report `emailSent:false` when the platform refuses |
| Custom domain + HTTPS | Base44 dashboard | **decision** |
| Payment provider (Stripe or Wix Payments via Base44) | Base44 integration | Not configured |

No secrets are stored in this repository.

## 4. Payments (not implemented)

Implemented: plan model with no prices (`base44/shared/entitlements.ts`),
`Subscription` entity, optional athlete-limit check in `inviteAthlete`.

Still needed: **decision** on plans, limits and prices; provider account and
merchant approval; checkout; a webhook function that verifies the provider
signature, stores `last_event_id` for idempotency and is the only writer of
`Subscription`; cancellation/failed-payment handling; billing portal; tests.

## 5. Legal and data protection (decision / external)

* Privacy policy and terms; consent at sign-up.
* Athletes may be minors (youth football). Decide parental-consent handling
  before onboarding under-18s; no date of birth is collected today.
* Rehab and wellness data are health data: decide retention, export and
  deletion handling; data-processing terms with Base44.
* AI features: disclose that AI drafts and video reviews are coaching aids,
  not medical assessments (the UI says this).

## 6. Operations

* Error monitoring: functions log to Base44 logs (`base44 logs`); no external
  monitoring configured.
* Backups: confirm Base44’s backup/restore policy and export schedule.
* Smoke test after each deploy: sign up as coach, invite, accept as athlete,
  schedule, log session, record a test, message, create rehab plan, remove
  athlete, confirm access ends.

## 7. Before go-live

- [ ] `npm install && npm run build && npm run lint` pass
- [ ] `bun test` passes
- [ ] All `docs/TESTING.md` manual rows pass on a test app
- [ ] Mobile pass of every page at 375 px
- [ ] Legal pages live
- [ ] Deployed via a supported route and verified on the live URL
