import { rolesMatrixMarkdown } from "./permissions-matrix";

/** Full text of docs/ROLES.md. `npm run docs:roles` rewrites the file; the test compares it. */
export function rolesDoc(): string {
  return `# Roles and access

Generated from \`src/lib/permissions.ts\` by \`npm run docs:roles\` (a unit test fails if this file is stale).
The menu and the page guards use this table; the database enforces the same boundaries on data with
row-level security (see ADR 0002). ✓ means the login can open the section.

${rolesMatrixMarkdown()}

Notes

- For athletes, every ✓ section shows their own data only (for example "My Training", "My Results").
- The director reads everything about the club's roster athletes (read-only) but cannot build training or use the exercise library.
- The physiotherapist covers the medical side: injuries and clearance, wellness, tests, rehab and prevention programs, GPS.
- Only the primary coach, a team's head coach or head of performance, or a team physiotherapist can record "cleared" for an injury.
- Messages are one-to-one between people who work together; files follow the access rules of the record they are attached to.
`;
}
