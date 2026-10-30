# Roles and access

Generated from `src/lib/permissions.ts` by `npm run docs:roles` (a unit test fails if this file is stale).
The menu and the page guards use this table; the database enforces the same boundaries on data with
row-level security (see ADR 0002). ✓ means the login can open the section from the menu; ○ means it opens from
another page (an exercise from a workout, a test from My Progress) but is not in the menu.

| Section | Director | Head coach | Head of performance | Physiotherapist | Other academy staff | Athlete |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Staff | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| My Athletes | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| AI Assistant | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| Training Calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workout Planner (athletes: Workout Tracker) |  | ✓ | ✓ | ✓ | ✓ | ✓ |
| Coach Notes |  |  |  |  |  | ✓ |
| My Progress |  |  |  |  |  | ✓ |
| Nutrition |  | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exercise Library |  | ✓ | ✓ | ✓ | ✓ | ○ |
| Testing |  | ✓ | ✓ | ✓ | ✓ | ○ |
| Payments | ✓ |  |  |  |  |  |
| Messages | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Join the academy |  |  |  |  |  | ✓ |
| Notifications | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| *Can build programs and exercises* |  | ✓ | ✓ | ✓ | ✓ |  |

Notes

- For athletes, every ✓ section shows their own data only (for example "Workout Tracker", "My Progress", "Nutrition").
- The director runs the academy (staff, roster, calendar) and reads athlete data read-only; building and testing training is the staff's job.
- Head coaches and assistant coaches see the athletes of their squads once the academy has squads (set up on the Staff page).
- Payments are the director's only: staff and athletes never see them (enforced in the database).
- Meal logs belong to the athlete; staff who work with the athlete read them and comment. The director does not see them.
- The AI assistant answers questions about numbers only from rows the asker may read.
- Messages are one-to-one between people who work together; files follow the access rules of the record they are attached to.
- Groups, readiness, injuries, GPS, wearables and the personal code come from Performance360 and are closed in Academy360.
