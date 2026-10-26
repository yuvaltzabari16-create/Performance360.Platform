import { describe, expect, it } from "vitest";
import { canAccess, canImportGps, canWriteTraining, sectionsFor } from "./permissions";

describe("permissions", () => {
  it("gives the director the club overview, athletes, squads, schedule, injuries, messages, GPS and settings", () => {
    for (const s of ["dashboard", "athletes", "teams", "calendar", "injuries", "messages", "gps", "team", "settings"] as const) {
      expect(canAccess(s, "org_admin", "director")).toBe(true);
    }
    for (const s of ["training", "testing", "exercises", "readiness", "wearables", "code"] as const) expect(canAccess(s, "org_admin", "director")).toBe(false);
    expect(canWriteTraining("director")).toBe(false);
  });
  it("gives the physiotherapist the medical side, tests, rehab programs and GPS import", () => {
    for (const s of ["injuries", "readiness", "training", "exercises", "gps", "athletes"] as const) expect(canAccess(s, "physiotherapist", "physiotherapist")).toBe(true);
    expect(canAccess("testing", "physiotherapist", "physiotherapist")).toBe(true);
    expect(canWriteTraining("physiotherapist")).toBe(true);
    expect(canImportGps("physiotherapist")).toBe(true);
    expect(canImportGps("director")).toBe(false);
  });
  it("gives the head of performance the performance side", () => {
    for (const s of ["training", "exercises", "testing", "teams", "gps", "readiness"] as const) expect(canAccess(s, "performance_coach", "head_of_performance")).toBe(true);
    expect(canAccess("code", "performance_coach", "head_of_performance")).toBe(false);
    expect(canImportGps("head_of_performance")).toBe(true);
  });
  it("gives the head coach the full professional set of a team", () => {
    for (const s of ["training", "exercises", "testing", "athletes", "injuries", "gps", "team", "messages"] as const) expect(canAccess(s, "performance_coach", "head_coach")).toBe(true);
  });
  it("gives an independent personal trainer the full professional set including a personal code", () => {
    expect(canAccess("code", "personal_trainer", null)).toBe(true);
    expect(canAccess("team", "personal_trainer", null)).toBe(false);
    expect(sectionsFor("personal_trainer", null)).toContain("training");
  });
  it("keeps athletes out of coach sections but gives them their own GPS results", () => {
    expect(canAccess("athletes", "athlete", null)).toBe(false);
    expect(canAccess("training", "athlete", null)).toBe(true);
    expect(canAccess("injuries", "athlete", null)).toBe(true);
    expect(canAccess("gps", "athlete", null)).toBe(true);
  });
});
