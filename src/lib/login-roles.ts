import type { OrgRole, UserRole } from "./types";

/** The sign-in options shown on the login page. */
/** Performance360 Academy has three logins: Coach, Physiotherapist and Athlete. */
export const LOGIN_ROLES = ["head_coach", "physiotherapist", "athlete"] as const;
export type LoginRole = (typeof LOGIN_ROLES)[number];

export const isLoginRole = (v: string | null | undefined): v is LoginRole => (LOGIN_ROLES as readonly string[]).includes(v ?? "");

/** Whether an account (profile role + team role) is the kind of login the person chose. */
export function matchesLoginRole(choice: LoginRole, role: UserRole | null, orgRole: OrgRole | null): boolean {
  switch (choice) {
    case "athlete": return role === "athlete";
    default: return orgRole === choice; // head_coach (Coach) or physiotherapist
  }
}
