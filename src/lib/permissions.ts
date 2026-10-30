/**
 * Which parts of the app each login can open. One table, used by the navigation and by the
 * page guards, so what a person sees in the menu is exactly what they can reach.
 * The database enforces the same boundaries on data (row-level security); this is the front door.
 *
 * Performance360 Academy has three roles: Coach, Physiotherapist and Athlete. Coaches and physiotherapists open the
 * dashboard, my athletes, AI assistant, training calendar, messages, staff, workout planner, exercise library, testing
 * and nutrition; the academy owner (a coach) also opens payments. Athletes get their own set below. The other modules inherited from
 * Performance360 (groups, readiness, injuries, GPS, wearables, personal code) stay in the code base
 * but are closed here, so their pages redirect and they never appear in the menu.
 */
import type { OrgRole, UserRole } from "./types";

export const SECTIONS = [
  "dashboard", "team", "athletes", "assistant", "teams", "calendar", "training", "notes", "progress", "nutrition", "exercises", "testing", "payments",
  "readiness", "injuries", "messages", "gps", "wearables", "code", "connect", "notifications", "settings",
] as const;
export type Section = (typeof SECTIONS)[number];

const ACCOUNT: Section[] = ["notifications", "settings"];

/** Coaches and physiotherapists: everything the academy offers except payments, plus their athletes' meal logs. */
const STAFF: Section[] = ["dashboard", "assistant", "messages", ...ACCOUNT, "team", "athletes", "calendar", "training", "exercises", "testing", "nutrition"];

/** The academy owner is a coach who also tracks payments. */
const OWNER: Section[] = [...STAFF, "payments"];

/** An account without an academy (left or not yet joined) keeps its own athletes and tools. */
const UNATTACHED: Section[] = STAFF.filter((s) => s !== "team");

/**
 * The athlete login: dashboard, training calendar, messages, workout tracker, coach notes, my progress and nutrition,
 * plus joining the academy. Exercise and test pages open from a workout or from My Progress, so they stay reachable.
 */
const ATHLETE: Section[] = ["dashboard", "calendar", "messages", "training", "notes", "progress", "nutrition", "exercises", "testing", "connect", ...ACCOUNT];

/** Sections a login can open but that are reached from other pages rather than the menu. */
const OFF_MENU: Partial<Record<"athlete", Section[]>> = { athlete: ["exercises", "testing"] };

/** Sections the given login can open. Coach and Physiotherapist share a set; the owner adds payments. */
export function sectionsFor(role: UserRole | null | undefined, orgRole: OrgRole | null | undefined, owner = false): Section[] {
  if (role === "athlete") return ATHLETE;
  if (orgRole) return owner ? OWNER : STAFF;
  return UNATTACHED;
}

/** Sections shown in the menu: what the login can open, minus pages reached from elsewhere. */
export function menuSectionsFor(role: UserRole | null | undefined, orgRole: OrgRole | null | undefined, owner = false): Section[] {
  const hidden = role === "athlete" ? OFF_MENU.athlete ?? [] : [];
  return sectionsFor(role, orgRole, owner).filter((s) => !hidden.includes(s));
}

export const canAccess = (section: Section, role: UserRole | null | undefined, orgRole: OrgRole | null | undefined, owner = false) =>
  sectionsFor(role, orgRole, owner).includes(section);

/** Whether this login may create training programs and their own exercises (every coach and physiotherapist). */
export const canWriteTraining = (orgRole: OrgRole | null | undefined) => orgRole !== "director";

/** Whether this login may import GPS files (everyone who works with athletes except the director). */
export const canImportGps = (orgRole: OrgRole | null | undefined) => orgRole !== "director";
