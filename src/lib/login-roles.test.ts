import { describe, expect, it } from "vitest";
import { isLoginRole, matchesLoginRole } from "./login-roles";

describe("login roles", () => {
  it("matches team roles by their team role", () => {
    expect(matchesLoginRole("director", "org_admin", "director")).toBe(true);
    expect(matchesLoginRole("physiotherapist", "physiotherapist", "physiotherapist")).toBe(true);
    expect(matchesLoginRole("head_coach", "performance_coach", "head_of_performance")).toBe(false);
  });
  it("tells athletes and independent trainers apart", () => {
    expect(matchesLoginRole("athlete", "athlete", null)).toBe(true);
    expect(matchesLoginRole("personal_trainer", "personal_trainer", null)).toBe(true);
    expect(matchesLoginRole("personal_trainer", "performance_coach", "head_coach")).toBe(false);
    expect(matchesLoginRole("athlete", "personal_trainer", null)).toBe(false);
  });
  it("accepts only known options", () => {
    expect(isLoginRole("director")).toBe(true);
    expect(isLoginRole("admin")).toBe(false);
  });
});
