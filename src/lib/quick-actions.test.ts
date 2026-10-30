import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { canAccess } from "./permissions";
import { quickActionsFor } from "./quick-actions";

const t = getDictionary("en");
const ids = (role: Parameters<typeof quickActionsFor>[0], org: Parameters<typeof quickActionsFor>[1]) => quickActionsFor(role, org, t).map((a) => a.id);

describe("quick actions", () => {
  it("gives the athlete today's workout, the calendar, messages and the assistant", () => {
    expect(ids("athlete", null)).toEqual(["today", "schedule", "message", "assistant"]);
  });
  it("gives staff who build training the building actions", () => {
    const hop = ids("performance_coach", "head_of_performance");
    for (const a of ["athlete", "test", "program", "message", "squad", "assistant"]) expect(hop).toContain(a);
    for (const a of ["injury", "gps", "code"]) expect(hop).not.toContain(a);
  });
  it("keeps the director to inviting, messaging, the schedule and the assistant", () => {
    const dir = ids("org_admin", "director");
    expect(dir).toEqual(["invite", "message", "schedule", "assistant"]);
    for (const a of ["program", "test", "athlete"]) expect(dir).not.toContain(a);
  });
  it("only links to pages the login can open", () => {
    const section = (href: string) => href.split("/")[1].split("?")[0];
    const map: Record<string, Parameters<typeof canAccess>[0]> = { athletes: "athletes", testing: "testing", training: "training", messages: "messages", calendar: "calendar", team: "team", assistant: "assistant" };
    for (const [role, org] of [["athlete", null], ["org_admin", "director"], ["physiotherapist", "physiotherapist"], ["performance_coach", "head_coach"]] as const) {
      for (const a of quickActionsFor(role, org, t)) expect(canAccess(map[section(a.href)], role, org)).toBe(true);
    }
  });
});
