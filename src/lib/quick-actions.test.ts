import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { quickActionsFor } from "./quick-actions";

const t = getDictionary("en");
const ids = (role: Parameters<typeof quickActionsFor>[0], org: Parameters<typeof quickActionsFor>[1]) => quickActionsFor(role, org, t).map((a) => a.id);

describe("quick actions", () => {
  it("gives the athlete check-in, today's workout, pain report, messages and wearables", () => {
    expect(ids("athlete", null)).toEqual(["checkin", "today", "injury", "message", "wearable"]);
  });
  it("gives staff who build training the building actions", () => {
    const hop = ids("performance_coach", "head_of_performance");
    for (const a of ["athlete", "test", "program", "injury", "message", "gps", "squad"]) expect(hop).toContain(a);
  });
  it("keeps the director to reading, messaging and inviting", () => {
    const dir = ids("org_admin", "director");
    expect(dir).toEqual(["invite", "message", "injuries", "schedule", "gps"]);
    for (const a of ["program", "test", "athlete"]) expect(dir).not.toContain(a);
  });
  it("gives an independent trainer a personal code", () => {
    expect(ids("performance_coach", null)).toContain("code");
    expect(ids("performance_coach", "head_coach")).not.toContain("code");
  });
  it("only links to pages the login can open", () => {
    for (const [role, org] of [["athlete", null], ["org_admin", "director"], ["physiotherapist", "physiotherapist"], ["performance_coach", "head_coach"]] as const) {
      for (const a of quickActionsFor(role, org, t)) expect(a.href.startsWith("/")).toBe(true);
    }
  });
});
