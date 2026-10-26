# Roles and access

Generated from `src/lib/permissions.ts` by `npm run docs:roles` (a unit test fails if this file is stale).
The menu and the page guards use this table; the database enforces the same boundaries on data with
row-level security (see ADR 0002). ✓ means the login can open the section.

| Section | Director | Head coach | Head of performance | Physiotherapist | Other team staff | Personal trainer | Athlete |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| My Team (staff) | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |
| Athletes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| Groups | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |
| Calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Training Planner |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exercise Library |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Testing |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Readiness |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Injuries | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Messages | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GPS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Wearables |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Personal Code |  | ✓ |  |  | ✓ | ✓ |  |
| Connect to a coach |  |  |  |  |  |  | ✓ |
| Notifications | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| *Can build programs and exercises* |  | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| *Can import GPS files* |  | ✓ | ✓ | ✓ | ✓ | ✓ |  |

Notes

- For athletes, every ✓ section shows their own data only (for example "My Training", "My Results").
- The director reads everything about the club's roster athletes (read-only) but cannot build training or use the exercise library.
- The physiotherapist covers the medical side: injuries and clearance, wellness, tests, rehab and prevention programs, GPS.
- Only the primary coach, a team's head coach or head of performance, or a team physiotherapist can record "cleared" for an injury.
- Messages are one-to-one between people who work together; files follow the access rules of the record they are attached to.
