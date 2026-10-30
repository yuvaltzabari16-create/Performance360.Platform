import { sessionLoad } from "./metrics";
import { shiftDay } from "./nutrition";

export interface CompletionRow { completed_on: string; status: "completed" | "partial" | "skipped"; session_rpe: number | null; duration_min: number | null }

/** Monday of the ISO week a date falls in. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return shiftDay(day, -((d.getUTCDay() + 6) % 7));
}

/** Workouts done and training load (session RPE × minutes) per week, for the `weeks` weeks ending with today's week. */
export function weeklyTraining(rows: CompletionRow[], today: string, weeks = 8): { label: string; week: string; workouts: number; load: number }[] {
  const last = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const week = shiftDay(last, (i - weeks + 1) * 7);
    const inWeek = rows.filter((r) => r.status !== "skipped" && weekStart(r.completed_on) === week);
    const load = inWeek.reduce((s, r) => s + (sessionLoad(r.session_rpe, r.duration_min) ?? 0), 0);
    return { label: week.slice(5), week, workouts: inWeek.length, load };
  });
}

export interface WorkoutStats { done30: number; doneAll: number; skipped30: number; completionRate30: number | null; avgRpe30: number | null }

export function workoutStats(rows: CompletionRow[], today: string): WorkoutStats {
  const since = shiftDay(today, -29);
  const recent = rows.filter((r) => r.completed_on >= since && r.completed_on <= today);
  const done30 = recent.filter((r) => r.status !== "skipped").length;
  const skipped30 = recent.length - done30;
  const rpes = recent.filter((r) => r.status !== "skipped" && r.session_rpe != null).map((r) => r.session_rpe!);
  return {
    done30,
    doneAll: rows.filter((r) => r.status !== "skipped").length,
    skipped30,
    completionRate30: recent.length ? Math.round((done30 / recent.length) * 100) : null,
    avgRpe30: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
  };
}
