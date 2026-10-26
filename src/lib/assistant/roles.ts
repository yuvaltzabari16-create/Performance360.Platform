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
