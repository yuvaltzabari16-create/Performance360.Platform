import { describe, expect, it } from "vitest";
import { SECTIONS, canAccess, canWriteTraining, menuSectionsFor, sectionsFor } from "./permissions";
import type { OrgRole } from "./types";

const ACADEMY = ["dashboard", "athletes", "assistant", "calendar", "messages", "team", "training", "exercises", "testing"] as const;
const CLOSED = ["teams", "readiness", "injuries", "gps", "wearables", "code"] as const;

describe("permissions", () => {
  it("opens the academy areas and their athletes' nutrition to coaching staff, but not payments", () => {
    for (const orgRole of ["head_coach", "head_of_performance", "assistant_coach", "physiotherapist", "sports_scientist", "other_staff"] as OrgRole[]) {
      for (const s of [...ACADEMY, "nutrition"] as const) expect(canAccess(s, "performance_coach", orgRole)).toBe(true);
      expect(canAccess("payments", "performance_coach", orgRole)).toBe(false);
    }
  });
  it("gives the director the academy view without the planner, library or testing", () => {
    for (const s of ["dashboard", "athletes", "assistant", "calendar", "messages", "team", "payments", "settings"] as const) expect(canAccess(s, "org_admin", "director")).toBe(true);
    for (const s of ["training", "exercises", "testing", "nutrition"] as const) expect(canAccess(s, "org_admin", "director")).toBe(false);
    expect(canWriteTraining("director")).toBe(false);
  });
  it("shows athletes dashboard, calendar, messages, workout tracker, coach notes, progress and nutrition", () => {
    const menu = menuSectionsFor("athlete", null);
    for (const s of ["dashboard", "calendar", "messages", "training", "notes", "progress", "nutrition"] as const) expect(menu).toContain(s);
    for (const s of ["athletes", "team", "payments", "assistant"] as const) expect(canAccess(s, "athlete", null)).toBe(false);
  });
  it("lets athletes open exercises and tests from their workouts and progress without listing them", () => {
    for (const s of ["exercises", "testing"] as const) {
      expect(canAccess(s, "athlete", null)).toBe(true);
      expect(menuSectionsFor("athlete", null)).not.toContain(s);
    }
    expect(menuSectionsFor("performance_coach", "head_coach")).toEqual(sectionsFor("performance_coach", "head_coach"));
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
