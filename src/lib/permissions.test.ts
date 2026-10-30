import { describe, expect, it } from "vitest";
import { SECTIONS, canAccess, canWriteTraining, sectionsFor } from "./permissions";
import type { OrgRole } from "./types";

const ACADEMY = ["dashboard", "athletes", "assistant", "calendar", "messages", "team", "training", "exercises", "testing"] as const;
const CLOSED = ["teams", "readiness", "injuries", "gps", "wearables", "code"] as const;

describe("permissions", () => {
  it("opens all nine academy areas to coaching staff", () => {
    for (const orgRole of ["head_coach", "head_of_performance", "assistant_coach", "physiotherapist", "sports_scientist", "other_staff"] as OrgRole[]) {
      for (const s of ACADEMY) expect(canAccess(s, "performance_coach", orgRole)).toBe(true);
    }
  });
  it("gives the director the academy view without the planner, library or testing", () => {
    for (const s of ["dashboard", "athletes", "assistant", "calendar", "messages", "team", "settings"] as const) expect(canAccess(s, "org_admin", "director")).toBe(true);
    for (const s of ["training", "exercises", "testing"] as const) expect(canAccess(s, "org_admin", "director")).toBe(false);
    expect(canWriteTraining("director")).toBe(false);
  });
  it("gives athletes their own workouts, calendar, tests, messages, assistant and the way to join", () => {
    for (const s of ["dashboard", "assistant", "calendar", "training", "exercises", "testing", "messages", "connect"] as const) expect(canAccess(s, "athlete", null)).toBe(true);
    for (const s of ["athletes", "team"] as const) expect(canAccess(s, "athlete", null)).toBe(false);
  });
  it("keeps the modules the academy does not use closed for every login", () => {
    for (const s of CLOSED) {
      expect(canAccess(s, "athlete", null)).toBe(false);
      expect(canAccess(s, "org_admin", "director")).toBe(false);
      expect(canAccess(s, "performance_coach", "head_coach")).toBe(false);
      expect(canAccess(s, "personal_trainer", null)).toBe(false);
    }
  });
  it("only lists known sections", () => {
    for (const s of sectionsFor("performance_coach", "head_coach")) expect(SECTIONS).toContain(s);
  });
});
