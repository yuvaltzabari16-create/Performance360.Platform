import { SECTIONS, canWriteTraining, menuSectionsFor, sectionsFor, type Section } from "./permissions";
import type { OrgRole, UserRole } from "./types";

/** The logins the matrix documents, with the account fields that define them. */
export const MATRIX_ROLES: { label: string; role: UserRole; orgRole: OrgRole | null; owner?: boolean }[] = [
  { label: "Coach (owner)", role: "performance_coach", orgRole: "head_coach", owner: true },
  { label: "Coach", role: "performance_coach", orgRole: "head_coach" },
  { label: "Physiotherapist", role: "physiotherapist", orgRole: "physiotherapist" },
  { label: "Athlete", role: "athlete", orgRole: null },
]

const SECTION_LABEL: Record<Section, string> = {
  dashboard: "Dashboard", team: "Staff", athletes: "My Athletes", assistant: "AI Assistant", teams: "Groups", calendar: "Training Calendar", training: "Workout Planner (athletes: Workout Tracker)",
  notes: "Coach Notes", progress: "My Progress", nutrition: "Nutrition", payments: "Payments",
  exercises: "Exercise Library", testing: "Testing", readiness: "Readiness", injuries: "Injuries", messages: "Messages", gps: "GPS", wearables: "Wearables",
  code: "Personal Code", connect: "Join the academy", notifications: "Notifications", settings: "Settings",
};

/** Markdown table of who can open what (sections no login opens are left out). docs/ROLES.md is generated from this; a test keeps them equal. */
export function rolesMatrixMarkdown(): string {
  const head = `| Section | ${MATRIX_ROLES.map((r) => r.label).join(" | ")} |`;
  const rule = `| --- | ${MATRIX_ROLES.map(() => ":---:").join(" | ")} |`;
  // "✓" opens from the menu; "○" opens from other pages (for example an exercise from a workout) but is not in the menu.
  const mark = (r: (typeof MATRIX_ROLES)[number], s: Section) => (!sectionsFor(r.role, r.orgRole, r.owner).includes(s) ? "" : menuSectionsFor(r.role, r.orgRole, r.owner).includes(s) ? "✓" : "○");
  const rows = SECTIONS.filter((s) => MATRIX_ROLES.some((r) => sectionsFor(r.role, r.orgRole, r.owner).includes(s))).map((s) => `| ${SECTION_LABEL[s]} | ${MATRIX_ROLES.map((r) => mark(r, s)).join(" | ")} |`);
  const caps = [
    `| *Can build programs and exercises* | ${MATRIX_ROLES.map((r) => (r.role !== "athlete" && canWriteTraining(r.orgRole) ? "✓" : "")).join(" | ")} |`,
  ];
  return [head, rule, ...rows, ...caps].join("\n");
}
