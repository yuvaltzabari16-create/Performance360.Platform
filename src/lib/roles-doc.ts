import { rolesMatrixMarkdown } from "./permissions-matrix";

/** Full text of docs/ROLES.md. `npm run docs:roles` rewrites the file; the test compares it. */
export function rolesDoc(): string {
  return `# Roles and access

Generated from \`src/lib/permissions.ts\` by \`npm run docs:roles\` (a unit test fails if this file is stale).
The menu and the page guards use this table; the database enforces the same boundaries on data with
row-level security (see ADR 0002). ✓ means the login can open the section.

${rolesMatrixMarkdown()}

Notes

- For athletes, every ✓ section shows their own data only (for example "My Workouts", "My Results").
- The director runs the academy (staff, roster, calendar) and reads athlete data read-only; building and testing training is the staff's job.
- Head coaches and assistant coaches see the athletes of their squads once the academy has squads (set up on the Staff page).
- The AI assistant answers questions about numbers only from rows the asker may read.
- Messages are one-to-one between people who work together; files follow the access rules of the record they are attached to.
- Groups, readiness, injuries, GPS, wearables and the personal code come from Performance360 and are closed in Academy360.
`;
}
