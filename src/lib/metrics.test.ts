import { describe, expect, it } from "vitest";
import {
  ageFromDob,
  bestTrial,
  isImprovement,
  limbDifference,
  meanTrial,
  percentChange,
  readinessFlag,
  sessionLoad,
  summarizeResults,
  wellnessIndex,
} from "./metrics";

describe("trials", () => {
  it("picks max for jumps and min for sprints", () => {
    expect(bestTrial([38.1, 39.4, 38.9], true)).toBe(39.4);
    expect(bestTrial([1.85, 1.79, 1.82], false)).toBe(1.79);
    expect(bestTrial([], true)).toBeNull();
  });
  it("averages trials", () => {
    expect(meanTrial([2, 4])).toBe(3);
    expect(meanTrial([])).toBeNull();
  });
});

describe("change", () => {
  it("computes percent change and refuses meaningless references", () => {
    expect(percentChange(44, 40)).toBeCloseTo(10);
    expect(percentChange(44, 0)).toBeNull();
    expect(percentChange(null, 40)).toBeNull();
  });
  it("interprets direction", () => {
    expect(isImprovement(-2, false)).toBe(true);
    expect(isImprovement(-2, true)).toBe(false);
    expect(isImprovement(0, true)).toBeNull();
  });
  it("computes limb difference direction-aware", () => {
    expect(limbDifference(20, 25, true)).toBeCloseTo(20);
    expect(limbDifference(2.5, 2.0, false)).toBeCloseTo(20);
    expect(limbDifference(null, 25, true)).toBeNull();
  });
});

describe("summarizeResults", () => {
  const rows = [
    { tested_on: "2026-03-01", side: "both" as const, trials: [40, 41], is_baseline: false, method: "Contact mat" },
    { tested_on: "2026-01-01", side: "both" as const, trials: [36, 38], is_baseline: true, method: "Contact mat" },
    { tested_on: "2026-05-01", side: "both" as const, trials: [39.5], is_baseline: false, method: "Force plate" },
  ];
  it("orders by date and reports baseline/previous/PB", () => {
    const s = summarizeResults(rows, true);
    expect(s.latest).toBe(39.5);
    expect(s.previous).toBe(41);
    expect(s.personalBest).toBe(41);
    expect(s.baseline).toBe(38);
    expect(s.changeFromBaselinePct).toBeCloseTo(3.947, 2);
    expect(s.methods).toEqual(["Contact mat", "Force plate"]);
  });
  it("has no change for a single result", () => {
    const s = summarizeResults([rows[0]], true);
    expect(s.changeFromBaselinePct).toBeNull();
    expect(s.changeFromPreviousPct).toBeNull();
  });
});

describe("monitoring", () => {
  it("session load is rpe x minutes", () => {
    expect(sessionLoad(7, 60)).toBe(420);
    expect(sessionLoad(null, 60)).toBeNull();
  });
  it("wellness index inverts negative items and needs 3 answers", () => {
    expect(wellnessIndex({ sleep_quality: 5, mood: 5, motivation: 5, fatigue: 1, soreness: 1, stress: 1 })).toBe(5);
    expect(wellnessIndex({ sleep_quality: 3, mood: null, motivation: null, fatigue: 3, soreness: null, stress: null })).toBeNull();
  });
  it("flags drops relative to the athlete's own history only with enough data", () => {
    expect(readinessFlag(3, [4, 4.2, 4.1])).toBe(true);
    expect(readinessFlag(3.9, [4, 4.2, 4.1])).toBe(false);
    expect(readinessFlag(1, [4, 4])).toBe(false);
  });
  it("computes age", () => {
    expect(ageFromDob("2008-06-15", new Date("2026-06-14T12:00:00Z"))).toBe(17);
    expect(ageFromDob("2008-06-15", new Date("2026-06-15T12:00:00Z"))).toBe(18);
  });
});
