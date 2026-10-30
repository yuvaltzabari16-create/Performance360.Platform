import { describe, expect, it } from "vitest";
import { LOGIN_ROLES, isLoginRole, matchesLoginRole } from "./login-roles";

describe("login roles", () => {
  it("offers exactly Coach, Physiotherapist and Athlete", () => {
    expect([...LOGIN_ROLES]).toEqual(["head_coach", "physiotherapist", "athlete"]);
  });
  it("matches staff by their academy role", () => {
    expect(matchesLoginRole("head_coach", "performance_coach", "head_coach")).toBe(true);
    expect(matchesLoginRole("physiotherapist", "physiotherapist", "physiotherapist")).toBe(true);
    expect(matchesLoginRole("head_coach", "physiotherapist", "physiotherapist")).toBe(false);
  });
  it("matches athletes only to the athlete login", () => {
    expect(matchesLoginRole("athlete", "athlete", null)).toBe(true);
    expect(matchesLoginRole("athlete", "personal_trainer", null)).toBe(false);
  });
  it("accepts only known options", () => {
    expect(isLoginRole("head_coach")).toBe(true);
    for (const old of ["director", "head_of_performance", "personal_trainer", "admin"]) expect(isLoginRole(old)).toBe(false);
  });
});
