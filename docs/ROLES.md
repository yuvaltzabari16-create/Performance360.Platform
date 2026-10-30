# Roles and access

Generated from `src/lib/permissions.ts` by `npm run docs:roles` (a unit test fails if this file is stale).
The menu and the page guards use this table; the database enforces the same boundaries on data with
row-level security (see ADR 0002). ✓ means the login can open the section from the menu; ○ means it opens from
another page (an exercise from a workout, a test from My Progress) but is not in the menu.

| Section | Coach (owner) | Coach | Physiotherapist | Athlete |
| --- | :---: | :---: | :---: | :---: |
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Staff | ✓ | ✓ | ✓ |  |
| My Athletes | ✓ | ✓ | ✓ |  |
| AI Assistant | ✓ | ✓ | ✓ |  |
| Training Calendar | ✓ | ✓ | ✓ | ✓ |
| Workout Planner (athletes: Workout Tracker) | ✓ | ✓ | ✓ | ✓ |
| Coach Notes |  |  |  | ✓ |
| My Progress |  |  |  | ✓ |
| Nutrition | ✓ | ✓ | ✓ | ✓ |
| Exercise Library | ✓ | ✓ | ✓ | ○ |
| Testing | ✓ | ✓ | ✓ | ○ |
| Payments | ✓ |  |  |  |
| Messages | ✓ | ✓ | ✓ | ✓ |
| Join the academy |  |  |  | ✓ |
| Notifications | ✓ | ✓ | ✓ | ✓ |
| Settings | ✓ | ✓ | ✓ | ✓ |
| *Can build programs and exercises* | ✓ | ✓ | ✓ |  |

Notes

- Performance360 Academy has three roles: **Coach**, **Physiotherapist** and **Athlete**. Whoever creates the academy
  joins as a coach and is its **owner**; an owner can make other coaches owners. An academy always keeps at least one owner.
- Owners also invite staff, manage the roster, the athlete code and squads, see payments, and read every program
  assigned in the academy (each program is still edited only by the coach who built it).
- For athletes, every ✓ section shows their own data only (for example "Workout Tracker", "My Progress", "Nutrition").
- Once the academy uses squads, a coach who is not an owner sees only the athletes of their squads; physiotherapists
  and owners see the whole roster.
- Payments are visible to owners only (enforced in the database). Meal logs belong to the athlete; coaches and
  physiotherapists who work with the athlete read them and comment.
- The AI assistant answers questions about numbers only from rows the asker may read.
- Messages are one-to-one between people who work together; files follow the access rules of the record they are attached to.
- Groups, readiness, injuries, GPS, wearables and the personal code come from Performance360 and are closed here.
