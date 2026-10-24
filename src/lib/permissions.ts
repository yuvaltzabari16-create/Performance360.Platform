/**
 * Which parts of the app each login can open. One table, used by the navigation and by the
 * page guards, so what a person sees in the menu is exactly what they can reach.
 * The database enforces the same boundaries on data (row-level security); this is the front door.
 */
import type { OrgRole, UserRole } from "./types";

export const SECTIONS = [
  "dashboard", "team", "athletes", "teams", "calendar", "training", "exercises", "testing", "readiness", "injuries", "code", "connect", "notifications", "settings",
] as const;
export type Section = (typeof SECTIONS)[number];

const COMMON: Section[] = ["dashboard", "notifications", "settings"];

/** Sections per team role. Roles missing here get the full professional set. */
const BY_ORG_ROLE: Partial<Record<OrgRole, Section[]>> = {
  // Runs the club: staff, roster counts, billing. No athlete records and no performance content.
  director: [...COMMON, "team"],
  // Medical side: injuries and clearance, athlete records, screening tests, wellness, the rehab library.
  // Does not write training programs.
  physiotherapist: [...COMMON, "team", "athletes", "calendar", "exercises", "testing", "readiness", "injuries"],
  // Performance side: programs, library, testing, load, groups, and the injury board to plan around it.
  head_of_performance: [...COMMON, "team", "athletes", "teams", "calendar", "training", "exercises", "testing", "readiness", "injuries"],
};

const PROFESSIONAL: Section[] = [...COMMON, "athletes", "teams", "calendar", "training", "exercises", "testing", "readiness", "injuries", "code"];
const TEAM_PROFESSIONAL: Section[] = [...PROFESSIONAL.slice(0, 3), "team", ...PROFESSIONAL.slice(3)];
const ATHLETE: Section[] = [...COMMON, "calendar", "training", "exercises", "testing", "readiness", "injuries", "connect"];

/** Sections the given login can open. */
export function sectionsFor(role: UserRole | null | undefined, orgRole: OrgRole | null | undefined): Section[] {
  if (role === "athlete") return ATHLETE;
  if (orgRole) return BY_ORG_ROLE[orgRole] ?? TEAM_PROFESSIONAL;
  return PROFESSIONAL;
}

export const canAccess = (section: Section, role: UserRole | null | undefined, orgRole: OrgRole | null | undefined) =>
  sectionsFor(role, orgRole).includes(section);

/** Whether this login may create training programs and their own exercises. */
export const canWriteTraining = (orgRole: OrgRole | null | undefined) => orgRole !== "director" && orgRole !== "physiotherapist";
