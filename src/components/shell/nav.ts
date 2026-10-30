import type { Dictionary } from "@/lib/i18n";
import { menuSectionsFor, type Section } from "@/lib/permissions";
import type { OrgRole, UserRole } from "@/lib/types";

export type NavIcon =
  | "home" | "team" | "users" | "group" | "calendar" | "library" | "sparkle" | "note" | "trend" | "meal" | "card" | "chart" | "pulse" | "pin" | "chat" | "key" | "link" | "bell" | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

/** Menu entries per section; the label differs for athletes on a few of them. */
function entry(section: Section, role: UserRole, t: Dictionary): NavItem {
  const athlete = role === "athlete";
  switch (section) {
    case "dashboard": return { href: "/dashboard", label: t.nav.dashboard, icon: "home" };
    case "team": return { href: "/team", label: t.nav.team, icon: "team" };
    case "athletes": return { href: "/athletes", label: t.nav.athletes, icon: "users" };
    case "assistant": return { href: "/assistant", label: t.nav.assistant, icon: "sparkle" };
    case "notes": return { href: "/notes", label: t.nav.notes, icon: "note" };
    case "progress": return { href: "/progress", label: t.nav.progress, icon: "trend" };
    case "nutrition": return { href: "/nutrition", label: t.nav.nutrition, icon: "meal" };
    case "payments": return { href: "/payments", label: t.nav.payments, icon: "card" };
    case "teams": return { href: "/teams", label: t.nav.teams, icon: "group" };
    case "calendar": return { href: "/calendar", label: t.nav.calendar, icon: "calendar" };
    case "training": return { href: "/training", label: athlete ? t.nav.myTraining : t.nav.training, icon: athlete ? "library" : "chart" };
    case "exercises": return { href: "/exercises", label: t.nav.exercises, icon: "library" };
    case "testing": return { href: "/testing", label: athlete ? t.nav.myResults : t.nav.testing, icon: "chart" };
    case "readiness": return { href: "/readiness", label: t.nav.readiness, icon: "pulse" };
    case "injuries": return { href: "/injuries", label: t.nav.injuries, icon: "pulse" };
    case "messages": return { href: "/messages", label: t.nav.messages, icon: "chat" };
    case "wearables": return { href: "/wearables", label: t.nav.wearables, icon: "pulse" };
    case "gps": return { href: "/gps", label: t.nav.gps, icon: "pin" };
    case "code": return { href: "/code", label: t.nav.code, icon: "key" };
    case "connect": return { href: "/connect", label: t.nav.connect, icon: "link" };
    case "notifications": return { href: "/notifications", label: t.nav.notifications, icon: "bell" };
    case "settings": return { href: "/settings", label: t.nav.settings, icon: "settings" };
  }
}

/** Navigation for a login: the sections its role may open, in a fixed order. */
export function navFor(role: UserRole, t: Dictionary, orgRole: OrgRole | null = null, owner = false): NavItem[] {
  const allowed = menuSectionsFor(role, orgRole, owner);
  const order: Section[] = ["dashboard", "athletes", "assistant", "calendar", "messages", "team", "training", "notes", "progress", "nutrition", "exercises", "testing", "payments", "teams", "readiness", "injuries", "gps", "wearables", "code", "connect", "notifications", "settings"];
  return order.filter((s) => allowed.includes(s)).map((s) => entry(s, role, t));
}
