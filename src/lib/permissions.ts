/**
 * Which parts of the app each login can open. One table, used by the navigation and by the
 * page guards, so what a person sees in the menu is exactly what they can reach.
 * The database enforces the same boundaries on data (row-level security); this is the front door.
 */
import type { OrgRole, UserRole } from "./types";

export const SECTIONS = [
  "dashboard", "team", "athletes", "teams", "calendar", "training", "exercises", "testing", "readiness", "injuries", "messages", "gps", "wearables", "code", "connect", "notifications", "settings",
] as const;
export type Section = (typeof SECTIONS)[number];

const COMMON: Section[] = ["dashboard", "messages", "wearables", "notifications", "settings"];

/** Sections per team role. Roles missing here get the full professional set. */
const BY_ORG_ROLE: Partial<Record<OrgRole, Section[]>> = {
  // Bird's-eye view of the club: all information, read-only (roster, schedule, tests, wellness, injuries,
  // notes, GPS, squads, staff, messages). No training planner and no exercise library: building training
  // is the performance and medical staff's job.
  director: [...COMMON, "team", "athletes", "teams", "calendar", "testing", "readiness", "injuries", "gps"],
  // Medical side: athlete medical picture, wellness, tests, injuries and clearance, rehab and
  // injury-prevention programs (planner and library), and GPS (view and import).
  physiotherapist: [...COMMON, "team", "athletes", "calendar", "training", "exercises", "testing", "readiness", "injuries", "gps"],
  // Performance side: programs, library, testing, load, groups, and the injury board to plan around it.
  head_of_performance: [...COMMON, "team", "athletes", "teams", "calendar", "training", "exercises", "testing", "readiness", "injuries", "gps"],
};

const PROFESSIONAL: Section[] = [...COMMON, "athletes", "teams", "calendar", "training", "exercises", "testing", "readiness", "injuries", "gps", "code"];
const TEAM_PROFESSIONAL: Section[] = [...PROFESSIONAL.slice(0, 3), "team", ...PROFESSIONAL.slice(3)];
const ATHLETE: Section[] = [...COMMON, "calendar", "training", "exercises", "testing", "readiness", "injuries", "gps", "connect"];

/** Sections the given login can open. */
export function sectionsFor(role: UserRole | null | undefined, orgRole: OrgRole | null | undefined): Section[] {
  if (role === "athlete") return ATHLETE;
  if (orgRole) return BY_ORG_ROLE[orgRole] ?? TEAM_PROFESSIONAL;
  return PROFESSIONAL;
}

export const canAccess = (section: Section, role: UserRole | null | undefined, orgRole: OrgRole | null | undefined) =>
  sectionsFor(role, orgRole).includes(section);

/** Whether this login may create training programs and their own exercises (everyone but the director). */
export const canWriteTraining = (orgRole: OrgRole | null | undefined) => orgRole !== "director";

/** Whether this login may import GPS files (everyone who works with athletes except the director). */
export const canImportGps = (orgRole: OrgRole | null | undefined) => orgRole !== "director";
