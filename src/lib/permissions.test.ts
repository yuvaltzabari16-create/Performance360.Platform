import { describe, expect, it } from "vitest";
import { SECTIONS, canAccess, menuSectionsFor, sectionsFor } from "./permissions";

const ACADEMY = ["dashboard", "athletes", "assistant", "calendar", "messages", "team", "training", "exercises", "testing", "nutrition"] as const;
const CLOSED = ["teams", "readiness", "injuries", "gps", "wearables", "code"] as const;

describe("permissions", () => {
  it("opens the academy areas to coaches and physiotherapists, without payments", () => {
    for (const [role, orgRole] of [["performance_coach", "head_coach"], ["physiotherapist", "physiotherapist"]] as const) {
      for (const s of ACADEMY) expect(canAccess(s, role, orgRole)).toBe(true);
      expect(canAccess("payments", role, orgRole)).toBe(false);
    }
  });
  it("adds payments for the academy owner, who is otherwise a coach", () => {
    expect(canAccess("payments", "performance_coach", "head_coach", true)).toBe(true);
    for (const s of ACADEMY) expect(canAccess(s, "performance_coach", "head_coach", true)).toBe(true);
  });
  it("shows athletes dashboard, calendar, messages, workout tracker, coach notes, progress and nutrition", () => {
    const menu = menuSectionsFor("athlete", null);
    expect(menu).toEqual(["dashboard", "calendar", "messages", "training", "notes", "progress", "nutrition", "connect", "notifications", "settings"]);
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
      expect(canAccess(s, "performance_coach", "head_coach", true)).toBe(false);
      expect(canAccess(s, "physiotherapist", "physiotherapist")).toBe(false);
    }
  });
  it("only lists known sections", () => {
    for (const s of sectionsFor("performance_coach", "head_coach", true)) expect(SECTIONS).toContain(s);
  });
});
