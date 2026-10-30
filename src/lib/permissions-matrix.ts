import { SECTIONS, canWriteTraining, sectionsFor, type Section } from "./permissions";
import type { OrgRole, UserRole } from "./types";

/** The logins the matrix documents, with the account fields that define them. */
export const MATRIX_ROLES: { label: string; role: UserRole; orgRole: OrgRole | null }[] = [
  { label: "Director", role: "org_admin", orgRole: "director" },
  { label: "Head coach", role: "performance_coach", orgRole: "head_coach" },
  { label: "Head of performance", role: "performance_coach", orgRole: "head_of_performance" },
  { label: "Physiotherapist", role: "physiotherapist", orgRole: "physiotherapist" },
  { label: "Other academy staff", role: "performance_coach", orgRole: "assistant_coach" },
  { label: "Athlete", role: "athlete", orgRole: null },
];

const SECTION_LABEL: Record<Section, string> = {
  dashboard: "Dashboard", team: "Staff", athletes: "My Athletes", assistant: "AI Assistant", teams: "Groups", calendar: "Training Calendar", training: "Workout Planner",
  exercises: "Exercise Library", testing: "Testing", readiness: "Readiness", injuries: "Injuries", messages: "Messages", gps: "GPS", wearables: "Wearables",
  code: "Personal Code", connect: "Join the academy", notifications: "Notifications", settings: "Settings",
};

/** Markdown table of who can open what (sections no login opens are left out). docs/ROLES.md is generated from this; a test keeps them equal. */
export function rolesMatrixMarkdown(): string {
  const head = `| Section | ${MATRIX_ROLES.map((r) => r.label).join(" | ")} |`;
  const rule = `| --- | ${MATRIX_ROLES.map(() => ":---:").join(" | ")} |`;
  const rows = SECTIONS.filter((s) => MATRIX_ROLES.some((r) => sectionsFor(r.role, r.orgRole).includes(s))).map((s) => `| ${SECTION_LABEL[s]} | ${MATRIX_ROLES.map((r) => (sectionsFor(r.role, r.orgRole).includes(s) ? "✓" : "")).join(" | ")} |`);
  const caps = [
    `| *Can build programs and exercises* | ${MATRIX_ROLES.map((r) => (r.role !== "athlete" && canWriteTraining(r.orgRole) ? "✓" : "")).join(" | ")} |`,
  ];
  return [head, rule, ...rows, ...caps].join("\n");
}
