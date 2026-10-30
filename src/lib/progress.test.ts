import { describe, expect, it } from "vitest";
import { weekStart, weeklyTraining, workoutStats, type CompletionRow } from "./progress";

const c = (completed_on: string, status: CompletionRow["status"] = "completed", session_rpe: number | null = 6, duration_min: number | null = 60): CompletionRow => ({ completed_on, status, session_rpe, duration_min });

describe("progress", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-10-30")).toBe("2026-10-26"); // Friday
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday
  });
  it("counts workouts and load per week, skipping skipped sessions", () => {
    const w = weeklyTraining([c("2026-10-27"), c("2026-10-29", "partial", 8, 30), c("2026-10-28", "skipped"), c("2026-10-20")], "2026-10-30", 2);
    expect(w).toEqual([
      { label: "10-19", week: "2026-10-19", workouts: 1, load: 360 },
      { label: "10-26", week: "2026-10-26", workouts: 2, load: 600 },
    ]);
  });
  it("summarises the last 30 days", () => {
    const s = workoutStats([c("2026-10-30", "completed", 7), c("2026-10-10", "partial", 5), c("2026-10-09", "skipped"), c("2026-08-01")], "2026-10-30");
    expect(s).toEqual({ done30: 2, doneAll: 3, skipped30: 1, completionRate30: 67, avgRpe30: 6 });
    expect(workoutStats([], "2026-10-30").completionRate30).toBeNull();
  });
});
