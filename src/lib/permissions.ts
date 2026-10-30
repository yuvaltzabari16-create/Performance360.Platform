/**
 * Which parts of the app each login can open. One table, used by the navigation and by the
 * page guards, so what a person sees in the menu is exactly what they can reach.
 * The database enforces the same boundaries on data (row-level security); this is the front door.
 *
 * Academy360 opens nine areas: dashboard, my athletes, AI assistant, training calendar, messages,
 * staff, workout planner, exercise library and testing. The other modules inherited from
 * Performance360 (groups, readiness, injuries, GPS, wearables, personal code) stay in the code base
 * but are closed here, so their pages redirect and they never appear in the menu.
 */
import type { OrgRole, UserRole } from "./types";

export const SECTIONS = [
  "dashboard", "team", "athletes", "assistant", "teams", "calendar", "training", "exercises", "testing", "readiness", "injuries", "messages", "gps", "wearables", "code", "connect", "notifications", "settings",
] as const;
export type Section = (typeof SECTIONS)[number];

const COMMON: Section[] = ["dashboard", "assistant", "messages", "notifications", "settings"];

/** Staff who coach: everything the academy offers. */
const STAFF: Section[] = [...COMMON, "team", "athletes", "calendar", "training", "exercises", "testing"];

/** Sections per academy role. Roles missing here get the full staff set. */
const BY_ORG_ROLE: Partial<Record<OrgRole, Section[]>> = {
  // The academy director runs the academy: staff, the athlete roster, the training schedule and messages,
  // all read-only on athlete data. Building and measuring training is the coaching staff's job (and the
  // database only lets staff write programs and test results).
  director: [...COMMON, "team", "athletes", "calendar"],
};

/** An account without an academy (left or not yet joined) keeps its own athletes and tools. */
const UNATTACHED: Section[] = STAFF.filter((s) => s !== "team");
const ATHLETE: Section[] = [...COMMON, "calendar", "training", "exercises", "testing", "connect"];

/** Sections the given login can open. */
export function sectionsFor(role: UserRole | null | undefined, orgRole: OrgRole | null | undefined): Section[] {
  if (role === "athlete") return ATHLETE;
  if (orgRole) return BY_ORG_ROLE[orgRole] ?? STAFF;
  return UNATTACHED;
}

export const canAccess = (section: Section, role: UserRole | null | undefined, orgRole: OrgRole | null | undefined) =>
  sectionsFor(role, orgRole).includes(section);

/** Whether this login may create training programs and their own exercises (everyone but the director). */
export const canWriteTraining = (orgRole: OrgRole | null | undefined) => orgRole !== "director";

/** Whether this login may import GPS files (everyone who works with athletes except the director). */
export const canImportGps = (orgRole: OrgRole | null | undefined) => orgRole !== "director";
