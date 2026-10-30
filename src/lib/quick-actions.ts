import type { Dictionary } from "@/lib/i18n";
import { canAccess, canImportGps, canWriteTraining } from "@/lib/permissions";
import type { OrgRole, UserRole } from "@/lib/types";

export type QuickIcon = "userPlus" | "test" | "program" | "injury" | "chat" | "upload" | "checkin" | "key" | "calendar" | "squad" | "invite" | "wearable" | "assistant" | "meal" | "payment";

export interface QuickAction {
  id: string;
  href: string;
  label: string;
  icon: QuickIcon;
}

/**
 * Short actions for the "Quick actions" tab: the things a person does many times a day, one tap away.
 * Only actions the login may actually do appear (same permission table as the menu).
 */
export function quickActionsFor(role: UserRole, orgRole: OrgRole | null, t: Dictionary): QuickAction[] {
  const q = t.quick;
  const out: QuickAction[] = [];
  const can = (s: Parameters<typeof canAccess>[0]) => canAccess(s, role, orgRole);
  if (role === "athlete") {
    if (can("readiness")) out.push({ id: "checkin", href: "/readiness", label: q.checkin, icon: "checkin" });
    if (can("training")) out.push({ id: "today", href: "/training", label: q.todayWorkout, icon: "program" });
    if (can("injuries")) out.push({ id: "injury", href: "/injuries", label: q.reportPain, icon: "injury" });
    if (can("nutrition")) out.push({ id: "meal", href: "/nutrition", label: q.logMeal, icon: "meal" });
    if (can("calendar")) out.push({ id: "schedule", href: "/calendar", label: q.schedule, icon: "calendar" });
    if (can("messages")) out.push({ id: "message", href: "/messages", label: q.message, icon: "chat" });
    if (can("wearables")) out.push({ id: "wearable", href: "/wearables", label: q.wearables, icon: "wearable" });
    if (can("assistant")) out.push({ id: "assistant", href: "/assistant", label: q.askAssistant, icon: "assistant" });
    return out;
  }
  const writer = canWriteTraining(orgRole);
  if (orgRole === "director") {
    if (can("payments")) out.push({ id: "payments", href: "/payments", label: q.payments, icon: "payment" });
    if (can("team")) out.push({ id: "invite", href: "/team", label: q.inviteStaff, icon: "invite" });
    if (can("messages")) out.push({ id: "message", href: "/messages", label: q.message, icon: "chat" });
    if (can("injuries")) out.push({ id: "injuries", href: "/injuries", label: q.openInjuries, icon: "injury" });
    if (can("calendar")) out.push({ id: "schedule", href: "/calendar", label: q.schedule, icon: "calendar" });
    if (can("gps")) out.push({ id: "gps", href: "/gps", label: q.gps, icon: "upload" });
    if (can("assistant")) out.push({ id: "assistant", href: "/assistant", label: q.askAssistant, icon: "assistant" });
    return out;
  }
  if (can("athletes")) out.push({ id: "athlete", href: "/athletes/new", label: q.addAthlete, icon: "userPlus" });
  if (can("testing") && writer) out.push({ id: "test", href: "/testing/new", label: q.recordTest, icon: "test" });
  if (can("training") && writer) out.push({ id: "program", href: "/training/new", label: q.newProgram, icon: "program" });
  if (can("injuries")) out.push({ id: "injury", href: "/injuries", label: q.reportInjury, icon: "injury" });
  if (can("messages")) out.push({ id: "message", href: "/messages", label: q.message, icon: "chat" });
  if (can("gps") && canImportGps(orgRole)) out.push({ id: "gps", href: "/gps/import", label: q.importGps, icon: "upload" });
  if (can("code") && !orgRole) out.push({ id: "code", href: "/code", label: q.personalCode, icon: "key" });
  if (orgRole === "head_of_performance" && can("team")) out.push({ id: "squad", href: "/team", label: q.squads, icon: "squad" });
  if (can("assistant")) out.push({ id: "assistant", href: "/assistant", label: q.askAssistant, icon: "assistant" });
  return out;
}
