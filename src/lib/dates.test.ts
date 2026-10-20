import { describe, expect, it } from "vitest";
import { addDays, dateInZone, isValidTimeZone } from "./dates";

describe("dateInZone", () => {
  // 21:30 UTC on 20 Oct is already 00:30 on 21 Oct in Israel (UTC+3).
  const lateUtc = new Date("2026-10-20T21:30:00Z");
  it("uses the user's calendar day, not the UTC day", () => {
    expect(dateInZone(lateUtc, "Asia/Jerusalem")).toBe("2026-10-21");
    expect(dateInZone(lateUtc, "UTC")).toBe("2026-10-20");
    expect(dateInZone(lateUtc, "America/New_York")).toBe("2026-10-20");
  });
  it("falls back to UTC for an invalid zone", () => {
    expect(dateInZone(lateUtc, "Not/AZone")).toBe("2026-10-20");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects junk", () => {
    expect(isValidTimeZone("Asia/Jerusalem")).toBe(true);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("x".repeat(80))).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses month and leap-year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-10-20", -21)).toBe("2026-09-29");
  });
});
