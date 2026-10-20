# Security model

Performance360 runs on Base44: a React frontend, Base44 entities (with
row-level security, RLS) and Deno backend functions. There is no second
authentication system; Base44 auth is used everywhere.

## Two layers

1. **Entity RLS** (`base44/entities/*.jsonc`) can only compare a record’s
   fields with the signed-in user (`{{user.id}}`, `{{user.email}}`, role). It
   cannot check relationships such as “is this coach connected to this
   athlete”.
2. **Backend functions** (`base44/functions/*`) do every cross-user action.
   They authenticate with `base44.auth.me()`, load records with the service
   role, and decide with the pure rules in `base44/shared/policy.ts`. The
   coach–athlete link is re-checked on every call (`getActiveLink`).

The frontend hides navigation by role for tidiness only; it is never the
control.

## Data ownership

| Data | Owner | Who reads | Who writes |
| --- | --- | --- | --- |
| Test results (`PerformanceMetric`), check-ins (`ReadinessEntry`), rehab phases/exercises, video analyses | Athlete (`user_id`) | Athlete directly; linked coach via `athleteData`; admin | Only functions: `recordMetric`, `manageRehab`, `analyzeMovement` |
| Workouts | `user_id` (athlete, or the coach for their own library) | Owner; the prescribing coach while linked (`coach_id`, cleared on removal) | Owner for records they created; athlete results only via `completeWorkout`; copies for athletes only via `assignWorkout` |
| Coach–athlete links (`Assignment`) | — | Coach, addressed athlete, admin | Only `inviteAthlete`, `respondToInvitation`, `removeAthlete` |
| Messages | The pair | Coach and athlete of the thread | Only `sendMessage` (sender and role come from the session) |
| Teams / membership | Coach | Coach; members see their own membership | Team: coach; membership: functions only (coach may delete) |
| Subscription | Owner | Owner, admin | Admin / future verified webhook only |

## Roles

`athlete` and `coach` are chosen once at onboarding (`onboardUser`). After
that only an administrator can change a role (Base44 dashboard). `admin` can
never be self-assigned. `role`, `coach_id` and `onboarded` on `User` are
field-locked to admins (both the `write` key from Base44’s security docs and
the `update` key the generator used are set — confirm on the platform, see
`docs/TESTING.md` row 1).

Not implemented: club administrator and platform-administrator consoles,
multi-role users, strength-and-conditioning as a distinct permission set
(`User.coach_type` records the coach’s specialism only).

## Revocation

Removing an athlete (or an athlete leaving) sets the link to `removed`,
removes team membership, clears `coach_id` on that coach’s prescribed
workouts, and moves the athlete’s primary-coach pointer. Every function
re-checks the active link, so access ends immediately. Messages already
exchanged remain visible to both parties.

## Known residual risks

* Whether Base44 evaluates `update` rules against the new data (so a creator
  cannot re-point `user_id`) is unverified — `docs/TESTING.md` row 4.
* `$nor` support in RLS is unverified (Knowledge Base read rule).
* Profile photos are uploaded as public files (anyone with the URL can view
  them). Movement videos use private files with signed URLs.
* No rate limiting on AI functions beyond input-size caps; Base44’s own
  limits apply.
* Upload type/size checks are client-side only; Base44 `Core.Upload*`
  integrations do not expose server-side validation hooks.
* `WorkoutAssignment` rows (title, date, status) stay visible to a removed
  coach.
