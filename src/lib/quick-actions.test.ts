import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { canAccess } from "./permissions";
import { quickActionsFor } from "./quick-actions";

const t = getDictionary("en");
const ids = (role: Parameters<typeof quickActionsFor>[0], org: Parameters<typeof quickActionsFor>[1]) => quickActionsFor(role, org, t).map((a) => a.id);

describe("quick actions", () => {
  it("gives the athlete today's workout, logging a meal, the calendar and messages", () => {
    expect(ids("athlete", null)).toEqual(["today", "meal", "schedule", "message"]);
  });
  it("gives coaches and physiotherapists the building actions", () => {
    for (const [role, org] of [["performance_coach", "head_coach"], ["physiotherapist", "physiotherapist"]] as const) {
      const got = ids(role, org);
      for (const a of ["athlete", "test", "program", "message", "assistant"]) expect(got).toContain(a);
      for (const a of ["payments", "invite", "squad", "injury", "gps", "code"]) expect(got).not.toContain(a);
    }
  });
  it("adds payments, inviting staff and squads for the owner", () => {
    const owner = quickActionsFor("performance_coach", "head_coach", t, true).map((a) => a.id);
    for (const a of ["payments", "invite", "squad", "program", "test"]) expect(owner).toContain(a);
  });
  it("only links to pages the login can open", () => {
    const section = (href: string) => href.split("/")[1].split(/[?#]/)[0];
    const map: Record<string, Parameters<typeof canAccess>[0]> = { athletes: "athletes", testing: "testing", training: "training", messages: "messages", calendar: "calendar", team: "team", assistant: "assistant", nutrition: "nutrition", payments: "payments" };
    for (const [role, org, owner] of [["athlete", null, false], ["performance_coach", "head_coach", true], ["physiotherapist", "physiotherapist", false], ["performance_coach", "head_coach", false]] as const) {
      for (const a of quickActionsFor(role, org, t, owner)) expect(canAccess(map[section(a.href)], role, org, owner)).toBe(true);
    }
  });
});
