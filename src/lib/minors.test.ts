import { describe, expect, it } from "vitest";
import { ageOn, isMinor, missingGuardianConsent } from "./minors";

describe("minors", () => {
  it("computes whole years, including the birthday itself", () => {
    expect(ageOn("2008-10-25", "2026-10-24")).toBe(17);
    expect(ageOn("2008-10-25", "2026-10-25")).toBe(18);
    expect(ageOn(null, "2026-10-25")).toBeNull();
  });
  it("treats under 18 as minors, and nobody without a date of birth", () => {
    expect(isMinor("2012-01-01", "2026-10-25")).toBe(true);
    expect(isMinor("2000-01-01", "2026-10-25")).toBe(false);
    expect(isMinor(null, "2026-10-25")).toBe(false);
  });
  it("flags a minor without recorded consent", () => {
    expect(missingGuardianConsent({ date_of_birth: "2012-01-01", guardian_consent_at: null }, "2026-10-25")).toBe(true);
    expect(missingGuardianConsent({ date_of_birth: "2012-01-01", guardian_consent_at: "2026-09-01" }, "2026-10-25")).toBe(false);
    expect(missingGuardianConsent({ date_of_birth: "1990-01-01", guardian_consent_at: null }, "2026-10-25")).toBe(false);
  });
});
