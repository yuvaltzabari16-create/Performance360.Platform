import { describe, expect, it } from "vitest";
import { canAccess, canWriteTraining, sectionsFor } from "./permissions";

describe("permissions", () => {
  it("gives the director the club view but not the planner, library or testing", () => {
    for (const s of ["exercises", "training", "testing", "readiness", "code"] as const) {
      expect(canAccess(s, "org_admin", "director")).toBe(false);
    }
    expect(canAccess("team", "org_admin", "director")).toBe(true);
    for (const s of ["athletes", "calendar", "injuries", "messages", "teams", "gps", "team", "settings"] as const) expect(canAccess(s, "org_admin", "director")).toBe(true);
  });
  it("gives the physiotherapist the medical side but not program writing", () => {
    expect(canAccess("injuries", "physiotherapist", "physiotherapist")).toBe(true);
    expect(canAccess("training", "physiotherapist", "physiotherapist")).toBe(false);
    expect(canWriteTraining("physiotherapist")).toBe(false);
  });
  it("gives the head of performance the performance side", () => {
    for (const s of ["training", "exercises", "testing", "teams"] as const) expect(canAccess(s, "performance_coach", "head_of_performance")).toBe(true);
    expect(canAccess("code", "performance_coach", "head_of_performance")).toBe(false);
  });
  it("gives an independent personal trainer the full professional set including a personal code", () => {
    expect(canAccess("code", "personal_trainer", null)).toBe(true);
    expect(canAccess("team", "personal_trainer", null)).toBe(false);
    expect(sectionsFor("personal_trainer", null)).toContain("training");
  });
  it("keeps athletes out of coach sections", () => {
    expect(canAccess("athletes", "athlete", null)).toBe(false);
    expect(canAccess("injuries", "athlete", null)).toBe(true);
  });
});
