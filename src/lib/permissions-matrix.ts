import { SECTIONS, canImportGps, canWriteTraining, sectionsFor, type Section } from "./permissions";
import type { OrgRole, UserRole } from "./types";

/** The logins the matrix documents, with the account fields that define them. */
export const MATRIX_ROLES: { label: string; role: UserRole; orgRole: OrgRole | null }[] = [
  { label: "Director", role: "org_admin", orgRole: "director" },
  { label: "Head coach", role: "performance_coach", orgRole: "head_coach" },
  { label: "Head of performance", role: "performance_coach", orgRole: "head_of_performance" },
  { label: "Physiotherapist", role: "physiotherapist", orgRole: "physiotherapist" },
  { label: "Other team staff", role: "performance_coach", orgRole: "assistant_coach" },
  { label: "Personal trainer", role: "personal_trainer", orgRole: null },
  { label: "Athlete", role: "athlete", orgRole: null },
];

const SECTION_LABEL: Record<Section, string> = {
  dashboard: "Dashboard", team: "My Team (staff)", athletes: "Athletes", teams: "Groups", calendar: "Calendar", training: "Training Planner",
  exercises: "Exercise Library", testing: "Testing", readiness: "Readiness", injuries: "Injuries", messages: "Messages", gps: "GPS",
  code: "Personal Code", connect: "Connect to a coach", notifications: "Notifications", settings: "Settings",
};

/** Markdown table of who can open what. docs/ROLES.md is generated from this; a test keeps them equal. */
export function rolesMatrixMarkdown(): string {
  const head = `| Section | ${MATRIX_ROLES.map((r) => r.label).join(" | ")} |`;
  const rule = `| --- | ${MATRIX_ROLES.map(() => ":---:").join(" | ")} |`;
  const rows = SECTIONS.map((s) => `| ${SECTION_LABEL[s]} | ${MATRIX_ROLES.map((r) => (sectionsFor(r.role, r.orgRole).includes(s) ? "✓" : "")).join(" | ")} |`);
  const caps = [
    `| *Can build programs and exercises* | ${MATRIX_ROLES.map((r) => (r.role !== "athlete" && canWriteTraining(r.orgRole) ? "✓" : "")).join(" | ")} |`,
    `| *Can import GPS files* | ${MATRIX_ROLES.map((r) => (r.role !== "athlete" && canImportGps(r.orgRole) ? "✓" : "")).join(" | ")} |`,
  ];
  return [head, rule, ...rows, ...caps].join("\n");
}
