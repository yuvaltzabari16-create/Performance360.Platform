import type { Dictionary } from "@/lib/i18n";
import type { OrgRole, UserRole } from "@/lib/types";

export type NavIcon =
  | "home" | "team" | "users" | "group" | "calendar" | "library" | "chart" | "pulse" | "key" | "link" | "bell" | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

/** Navigation per role. Only shipped, working modules are listed. */
export function navFor(role: UserRole, t: Dictionary, orgRole: OrgRole | null = null): NavItem[] {
  if (role === "athlete") {
    return [
      { href: "/dashboard", label: t.nav.dashboard, icon: "home" },
      { href: "/training", label: t.nav.myTraining, icon: "calendar" },
      { href: "/testing", label: t.nav.myResults, icon: "chart" },
      { href: "/readiness", label: t.nav.readiness, icon: "pulse" },
      { href: "/exercises", label: t.nav.exercises, icon: "library" },
      { href: "/connect", label: t.nav.connect, icon: "link" },
      { href: "/notifications", label: t.nav.notifications, icon: "bell" },
      { href: "/settings", label: t.nav.settings, icon: "settings" },
    ];
  }
  if (orgRole === "director") {
    // The director runs the team; individual athlete records are not part of this role.
    return [
      { href: "/dashboard", label: t.nav.dashboard, icon: "home" },
      { href: "/team", label: t.nav.team, icon: "team" },
      { href: "/notifications", label: t.nav.notifications, icon: "bell" },
      { href: "/settings", label: t.nav.settings, icon: "settings" },
    ];
  }
  return [
    { href: "/dashboard", label: t.nav.dashboard, icon: "home" },
    ...(orgRole ? [{ href: "/team", label: t.nav.team, icon: "team" as const }] : []),
    { href: "/athletes", label: t.nav.athletes, icon: "users" },
    { href: "/teams", label: t.nav.teams, icon: "group" },
    { href: "/training", label: t.nav.training, icon: "calendar" },
    { href: "/exercises", label: t.nav.exercises, icon: "library" },
    { href: "/testing", label: t.nav.testing, icon: "chart" },
    { href: "/readiness", label: t.nav.readiness, icon: "pulse" },
    { href: "/code", label: t.nav.code, icon: "key" },
    { href: "/notifications", label: t.nav.notifications, icon: "bell" },
    { href: "/settings", label: t.nav.settings, icon: "settings" },
  ];
}
