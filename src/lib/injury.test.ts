import { describe, expect, it } from "vitest";
import { canClearByOrgRole, daysBetween, daysOut, isAvailable, nextStage, previousStage, returnOutlook, stageIndex } from "./injury";

describe("return-to-play stages", () => {
  it("moves one stage at a time and stops at the ends", () => {
    expect(nextStage("rest")).toBe("rehab");
    expect(nextStage("full")).toBe("cleared");
    expect(nextStage("cleared")).toBeNull();
    expect(previousStage("rest")).toBeNull();
    expect(previousStage("running")).toBe("rehab");
    expect(stageIndex("modified")).toBe(3);
    expect(stageIndex("nonsense")).toBe(0);
  });
  it("treats only full training and cleared as available", () => {
    expect(["rest", "rehab", "running", "modified"].some(isAvailable)).toBe(false);
    expect(isAvailable("full") && isAvailable("cleared")).toBe(true);
  });
});

describe("injury dates", () => {
  it("counts days across month and year boundaries", () => {
    expect(daysBetween("2026-10-01", "2026-10-24")).toBe(23);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
  it("counts days out, stopping at the resolved date", () => {
    expect(daysOut("2026-10-10", "2026-10-24")).toBe(14);
    expect(daysOut("2026-10-10", "2026-10-24", "2026-10-20")).toBe(10);
    expect(daysOut("2026-10-30", "2026-10-24")).toBe(0);
  });
  it("describes the expected return", () => {
    expect(returnOutlook(null, "2026-10-24")).toEqual({ kind: "none" });
    expect(returnOutlook("2026-10-31", "2026-10-24")).toEqual({ kind: "ahead", days: 7 });
    expect(returnOutlook("2026-10-24", "2026-10-24")).toEqual({ kind: "today" });
    expect(returnOutlook("2026-10-20", "2026-10-24")).toEqual({ kind: "overdue", days: 4 });
  });
});

describe("clearance roles", () => {
  it("allows the lead and medical roles only", () => {
    expect(canClearByOrgRole("physiotherapist")).toBe(true);
    expect(canClearByOrgRole("head_coach")).toBe(true);
    expect(canClearByOrgRole("assistant_coach")).toBe(false);
    expect(canClearByOrgRole("director")).toBe(false);
    expect(canClearByOrgRole(null)).toBe(false);
  });
});
