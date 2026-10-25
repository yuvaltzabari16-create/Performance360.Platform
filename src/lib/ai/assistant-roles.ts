import { sectionsFor, type Section } from "@/lib/permissions";
import type { OrgRole, UserRole } from "@/lib/types";

/** The seven kinds of login the chat assistant speaks to. */
export const ASSISTANT_ROLES = ["director", "head_coach", "head_of_performance", "physiotherapist", "team_staff", "personal_trainer", "athlete"] as const;
export type AssistantRole = (typeof ASSISTANT_ROLES)[number];

export function assistantRole(role: UserRole, orgRole: OrgRole | null): AssistantRole {
  if (role === "athlete") return "athlete";
  if (!orgRole) return "personal_trainer";
  if (orgRole === "director" || orgRole === "head_coach" || orgRole === "head_of_performance" || orgRole === "physiotherapist") return orgRole;
  return "team_staff";
}

/** What each section is for, in one plain sentence (the assistant explains these; keep them true). */
export const SECTION_HELP: Record<Section, string> = {
  dashboard: "Overview of what needs attention today.",
  team: "Club staff list, invitations and the athlete roster (My Team).",
  athletes: "Athlete profiles, notes, injuries, tests, wearables and files.",
  teams: "Groups of athletes for training and assignment.",
  calendar: "Month calendar of planned and completed training sessions.",
  training: "Training programs and the session builder (blocks, prescriptions, AI draft); for athletes, My Training and today's workout.",
  exercises: "Exercise library with demonstration videos and custom exercises.",
  testing: "Performance tests, trials, trends and CSV export; for athletes, My Results.",
  readiness: "Daily wellness check-ins and flags; athletes submit theirs here.",
  injuries: "Injury timeline from rest to cleared, with notes, files and the staff injury board.",
  messages: "Private one-to-one messages and file attachments with the people you work with.",
  gps: "GPS and wearable-system imports: distance, speed zones, sprints, load and pitch heat maps.",
  wearables: "WHOOP connection and Fitbit / WHOOP export import (recovery, HRV, sleep, strain); athletes control sharing.",
  code: "Personal code for athletes to connect to a personal trainer.",
  connect: "Connect to a coach or team with a code.",
  notifications: "In-app notifications.",
  settings: "Profile, units, language, two-factor authentication, idle sign-out, data export and account deletion.",
};

interface Brief { title: string; does: string[]; cannot: string[] }

export const ROLE_BRIEF: Record<AssistantRole, Brief> = {
  director: {
    title: "club director",
    does: ["sees the club from above, read-only: roster, schedule, tests, wellness, notes, injuries, GPS, groups", "manages staff and invitations", "sends messages"],
    cannot: ["build training programs or use the exercise library", "edit athlete data", "record injury stages or clearance"],
  },
  head_coach: {
    title: "head coach",
    does: ["works with the team's athletes: programs, sessions, tests, injuries, GPS, messages", "records clearance for an athlete returning from injury (with a written basis)"],
    cannot: ["invite staff (the director does)"],
  },
  head_of_performance: {
    title: "head of performance (strength and conditioning)",
    does: ["builds training programs and assigns them to athletes and groups", "tracks tests, readiness, GPS metrics and wearable data athletes share", "imports GPS files"],
    cannot: ["invite staff", "record clearance unless also the primary coach (head of performance can)"],
  },
  physiotherapist: {
    title: "physiotherapist (medical side)",
    does: ["manages injuries and records clearance with a written basis", "reviews wellness, tests and GPS load", "builds rehab and injury-prevention programs and library exercises", "imports GPS files"],
    cannot: ["see training groups", "invite staff"],
  },
  team_staff: {
    title: "team staff member",
    does: ["works with the team's athletes within the club: programs, tests, injuries, GPS, messages"],
    cannot: ["record final clearance", "invite staff"],
  },
  personal_trainer: {
    title: "independent personal trainer",
    does: ["works with their own connected athletes: programs, tests, injuries, GPS, messages", "shares a personal code so athletes can connect"],
    cannot: ["see any club's data"],
  },
  athlete: {
    title: "athlete",
    does: ["sees their own training, results, readiness, injuries, GPS and wearable data", "submits daily check-ins, reports problems, messages staff", "decides whether coaching staff can see their wearable data"],
    cannot: ["see other athletes' data", "build programs", "change injury stages"],
  },
};

/** Sections this kind of login can open, with their one-line help, for the system prompt. */
export function sectionGuide(role: UserRole, orgRole: OrgRole | null): string {
  return sectionsFor(role, orgRole).map((s) => `- ${s}: ${SECTION_HELP[s]}`).join("\n");
}
