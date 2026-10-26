import type { SessionSection } from "@/lib/catalog";
import type { RawExercise } from "./preview";
import type { WorkoutSpec } from "./parse";

/** Fixed prescription templates per section and level. Values go through the builder parser later. */

interface Basics { name: string; movement_pattern?: string | null; difficulty?: string | null }

const dec = (n: number, by: number, floor: number) => Math.max(floor, n - by);

export function prescribe(e: Basics, section: SessionSection, spec: WorkoutSpec): RawExercise & { name: string } {
  const low = spec.lowFatigue;
  const hold = /isometric|anti-/i.test(e.movement_pattern ?? "") || /plank|hold|bridge|wall sit|carry/i.test(e.name);
  const lvl = spec.level;
  const strengthReps = lvl === "beginner" ? "10" : lvl === "advanced" ? "5" : "8";
  const strengthRpe = lvl === "beginner" ? 6 : lvl === "advanced" ? 8 : 7;

  switch (section) {
    case "warmup":
    case "cooldown":
    case "recovery":
    case "mobility":
      return { name: e.name, sets: 2, durationSeconds: 30, ...(hold ? {} : { reps: "8" }) };
    case "activation":
      return { name: e.name, sets: low ? 2 : 3, reps: spec.focus === "rehab" ? "12" : "10", restSeconds: 45, rpe: spec.focus === "rehab" ? 4 : 5 };
    case "strength":
      if (spec.focus === "rehab") return { name: e.name, sets: 3, reps: "10", restSeconds: 60, rpe: 4 };
      return hold
        ? { name: e.name, sets: dec(3, low ? 1 : 0, 2), durationSeconds: 30, restSeconds: 60, rpe: strengthRpe - 1 }
        : { name: e.name, sets: dec(lvl === "beginner" ? 3 : 4, low ? 1 : 0, 2), reps: strengthReps, restSeconds: lvl === "advanced" ? 150 : 90, rpe: dec(strengthRpe, low ? 2 : 0, 4) };
    case "power":
      return { name: e.name, sets: dec(4, low ? 2 : 0, 2), reps: "3", restSeconds: 120, rpe: dec(7, low ? 2 : 0, 4) };
    case "plyometrics":
      return { name: e.name, sets: dec(3, low ? 1 : 0, 2), reps: low ? "3" : "5", restSeconds: 60, rpe: dec(7, low ? 2 : 0, 4) };
    case "sprint":
      return { name: e.name, sets: low ? 3 : 6, distanceMeters: 20, restSeconds: 90, rpe: dec(8, low ? 2 : 0, 5) };
    case "cod":
      return { name: e.name, sets: low ? 2 : 4, distanceMeters: 10, restSeconds: 60, rpe: dec(7, low ? 2 : 0, 4) };
    case "conditioning":
      return { name: e.name, sets: low ? 3 : 4, durationSeconds: 45, restSeconds: 45, rpe: dec(7, low ? 2 : 0, 4) };
    case "core":
      return hold
        ? { name: e.name, sets: 3, durationSeconds: 30, restSeconds: 30, rpe: 5 }
        : { name: e.name, sets: 3, reps: "10", restSeconds: 45, rpe: 5 };
  }
}
