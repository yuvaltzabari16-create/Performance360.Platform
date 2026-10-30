import type { SessionExercise } from "./types";

// Prescription fields shown as chips in the workout builder. Each chip edits one or two
// session_exercises columns; parsing is shared by the client (optimistic update) and the
// server action (authoritative validation).

export const FIELD_KEYS = ["reps", "load", "pct1rm", "rpe", "rir", "tempo", "duration", "distance", "rest", "intensity"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export type ExercisePatch = Partial<Pick<SessionExercise,
  "sets" | "reps" | "load_kg" | "percent_1rm" | "rpe" | "rir" | "tempo" | "duration_s" | "distance_m" | "rest_s" | "intensity_target">>;

export const FIELD_COLUMNS: Record<FieldKey, (keyof ExercisePatch)[]> = {
  reps: ["sets", "reps"],
  load: ["load_kg"],
  pct1rm: ["percent_1rm"],
  rpe: ["rpe"],
  rir: ["rir"],
  tempo: ["tempo"],
  duration: ["duration_s"],
  distance: ["distance_m"],
  rest: ["rest_s"],
  intensity: ["intensity_target"],
};

/** Soft colour per field, within the Academy360 palette (green primary, neutral and warm accents). */
export const FIELD_TONES: Record<FieldKey, string> = {
  reps: "border-brand-200 bg-brand-50 text-brand-800",
  load: "border-slate-300 bg-slate-100 text-slate-800",
  pct1rm: "border-teal-200 bg-teal-50 text-teal-800",
  rpe: "border-amber-200 bg-amber-50 text-amber-900",
  rir: "border-orange-200 bg-orange-50 text-orange-900",
  tempo: "border-violet-200 bg-violet-50 text-violet-900",
  duration: "border-sky-200 bg-sky-50 text-sky-900",
  distance: "border-cyan-200 bg-cyan-50 text-cyan-900",
  rest: "border-emerald-200 bg-emerald-50 text-emerald-900",
  intensity: "border-rose-200 bg-rose-50 text-rose-900",
};

export const isFieldKey = (v: unknown): v is FieldKey => typeof v === "string" && (FIELD_KEYS as readonly string[]).includes(v);

/** The text shown on a chip, or null when the field is empty. */
export function fieldDisplay(e: ExercisePatch, key: FieldKey): string | null {
  switch (key) {
    case "reps":
      if (e.sets && e.reps) return `${e.sets}x${e.reps}`;
      if (e.sets) return `${e.sets}x`;
      return e.reps || null;
    case "load": return e.load_kg == null ? null : `${e.load_kg}kg`;
    case "pct1rm": return e.percent_1rm == null ? null : `${e.percent_1rm}%`;
    case "rpe": return e.rpe == null ? null : String(e.rpe);
    case "rir": return e.rir == null ? null : String(e.rir);
    case "tempo": return e.tempo || null;
    case "duration": return e.duration_s == null ? null : `${e.duration_s}s`;
    case "distance": return e.distance_m == null ? null : `${e.distance_m}m`;
    case "rest": return e.rest_s == null ? null : `${e.rest_s}s`;
    case "intensity": return e.intensity_target || null;
  }
}

/** The text put in the input when a chip is edited (units stripped). */
export function fieldEditValue(e: ExercisePatch, key: FieldKey): string {
  switch (key) {
    case "reps": return fieldDisplay(e, "reps") ?? "";
    case "load": return e.load_kg == null ? "" : String(e.load_kg);
    case "pct1rm": return e.percent_1rm == null ? "" : String(e.percent_1rm);
    case "duration": return e.duration_s == null ? "" : String(e.duration_s);
    case "distance": return e.distance_m == null ? "" : String(e.distance_m);
    case "rest": return e.rest_s == null ? "" : String(e.rest_s);
    default: return fieldDisplay(e, key) ?? "";
  }
}

const toNumber = (raw: string) => {
  const stripped = raw.replace(",", ".").replace(/[a-z%]+$/i, "").trim();
  const n = Number(stripped);
  return stripped !== "" && Number.isFinite(n) ? n : null;
};

/** Seconds from "90", "90s", "1:30" or "1.5min". */
function toSeconds(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(s);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const min = /^(\d+(?:[.,]\d+)?)\s*(?:m|min|mins)$/.exec(s);
  if (min) return Math.round(Number(min[1].replace(",", ".")) * 60);
  const n = toNumber(s);
  return n == null ? null : Math.round(n);
}

export type ParseResult = { ok: true; patch: ExercisePatch } | { ok: false };

/** Turns what the coach typed into column values. An empty string clears the field. */
export function parseField(key: FieldKey, rawInput: string): ParseResult {
  const raw = rawInput.trim();
  const clear = raw === "";
  const inRange = (n: number | null, min: number, max: number) => n != null && n >= min && n <= max;
  switch (key) {
    case "reps": {
      if (clear) return { ok: true, patch: { sets: null, reps: null } };
      const m = /^(\d{1,2})\s*[x×*]\s*(.*)$/i.exec(raw);
      if (m) {
        const sets = Number(m[1]);
        if (sets < 1 || sets > 50) return { ok: false };
        return { ok: true, patch: { sets, reps: m[2].trim().slice(0, 40) || null } };
      }
      return { ok: true, patch: { reps: raw.slice(0, 40) } };
    }
    case "load": {
      const n = toNumber(raw);
      return clear ? { ok: true, patch: { load_kg: null } } : inRange(n, 0, 1000) ? { ok: true, patch: { load_kg: n } } : { ok: false };
    }
    case "pct1rm": {
      const n = toNumber(raw);
      return clear ? { ok: true, patch: { percent_1rm: null } } : inRange(n, 0, 120) ? { ok: true, patch: { percent_1rm: n } } : { ok: false };
    }
    case "rpe": {
      const n = toNumber(raw);
      return clear ? { ok: true, patch: { rpe: null } } : inRange(n, 0, 10) ? { ok: true, patch: { rpe: Math.round((n as number) * 2) / 2 } } : { ok: false };
    }
    case "rir": {
      const n = toNumber(raw);
      return clear ? { ok: true, patch: { rir: null } } : inRange(n, 0, 10) ? { ok: true, patch: { rir: Math.round(n as number) } } : { ok: false };
    }
    case "tempo": return { ok: true, patch: { tempo: clear ? null : raw.slice(0, 20) } };
    case "duration": {
      const n = toSeconds(raw);
      return clear ? { ok: true, patch: { duration_s: null } } : inRange(n, 1, 36000) ? { ok: true, patch: { duration_s: n } } : { ok: false };
    }
    case "distance": {
      const n = toNumber(raw);
      return clear ? { ok: true, patch: { distance_m: null } } : inRange(n, 0, 100000) ? { ok: true, patch: { distance_m: n } } : { ok: false };
    }
    case "rest": {
      const n = toSeconds(raw);
      return clear ? { ok: true, patch: { rest_s: null } } : inRange(n, 0, 3600) ? { ok: true, patch: { rest_s: n } } : { ok: false };
    }
    case "intensity": return { ok: true, patch: { intensity_target: clear ? null : raw.slice(0, 120) } };
  }
}

/** Fields that currently have a value, in display order. */
export function filledFields(e: ExercisePatch): FieldKey[] {
  return FIELD_KEYS.filter((k) => fieldDisplay(e, k) != null);
}
