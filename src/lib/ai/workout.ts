import { FIELD_KEYS, fieldEditValue, parseField, type ExercisePatch, type FieldKey } from "@/lib/builder-fields";
import { SESSION_SECTIONS, type SessionSection } from "@/lib/catalog";

/**
 * Turns a model's workout suggestion into something safe to save.
 *
 * The model is only trusted for ideas: every exercise must exist in the coach's library
 * (anything else is dropped), sections must be known, and every prescription value goes through
 * the same parser the builder uses. Pure functions, so the rules are easy to test.
 */

export interface LibraryRef { id: string; name: string }

/** One exercise as returned by the model (loosely typed on purpose: it is untrusted input). */
export interface RawExercise {
  name?: unknown; sets?: unknown; reps?: unknown; restSeconds?: unknown; rpe?: unknown; loadKg?: unknown;
  percent1rm?: unknown; durationSeconds?: unknown; distanceMeters?: unknown; tempo?: unknown;
}

export interface PreviewItem {
  exerciseId: string;
  name: string;
  /** Prescription as the text a coach would type into each chip. */
  values: Partial<Record<FieldKey, string>>;
}
export interface PreviewBlock { section: SessionSection; items: PreviewItem[] }
export interface WorkoutPreview {
  title: string;
  blocks: PreviewBlock[];
  /** Exercises that matched the library / were suggested in total. */
  matched: number;
  suggested: number;
}

/** JSON schema the model must follow (used as the forced tool input). */
export const WORKOUT_TOOL = {
  name: "build_workout",
  description: "Return the planned training session as sections with exercises taken only from the provided library.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short session title" },
      blocks: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            section: { type: "string", enum: [...SESSION_SECTIONS] },
            exercises: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Exact exercise name from the library list" },
                  sets: { type: "integer", minimum: 1, maximum: 10 },
                  reps: { type: "string", description: "e.g. 8, 8-10, 30s each side" },
                  restSeconds: { type: "integer", minimum: 0, maximum: 600 },
                  rpe: { type: "number", minimum: 0, maximum: 10 },
                  loadKg: { type: "number", minimum: 0 },
                  percent1rm: { type: "number", minimum: 0, maximum: 120 },
                  durationSeconds: { type: "integer", minimum: 1 },
                  distanceMeters: { type: "number", minimum: 0 },
                  tempo: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
          required: ["section", "exercises"],
        },
      },
    },
    required: ["title", "blocks"],
  },
} as const;

/** Same normalisation as the library import: lowercase letters/digits, trailing "s" dropped. */
export const exerciseKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");

const asText = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

/** Prescription values for one raw exercise, accepted only when the builder parser accepts them. */
function valuesFor(raw: RawExercise): Partial<Record<FieldKey, string>> {
  const sets = asText(raw.sets);
  const reps = asText(raw.reps);
  const candidates: Partial<Record<FieldKey, string>> = {
    reps: sets && reps ? `${sets}x${reps}` : sets ? `${sets}x` : reps,
    load: asText(raw.loadKg),
    pct1rm: asText(raw.percent1rm),
    rpe: asText(raw.rpe),
    tempo: asText(raw.tempo),
    duration: asText(raw.durationSeconds),
    distance: asText(raw.distanceMeters),
    rest: asText(raw.restSeconds),
  };
  const values: Partial<Record<FieldKey, string>> = {};
  for (const key of FIELD_KEYS) {
    const text = candidates[key];
    if (!text) continue;
    const parsed = parseField(key, text);
    if (!parsed.ok) continue;
    const shown = fieldEditValue(parsed.patch as ExercisePatch, key);
    if (shown) values[key] = shown;
  }
  return values;
}

/** Validates the model output against the library and returns a preview the coach can accept. */
export function buildPreview(raw: unknown, library: LibraryRef[]): WorkoutPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { title?: unknown; blocks?: unknown };
  if (!Array.isArray(data.blocks)) return null;
  const byKey = new Map(library.map((l) => [exerciseKey(l.name), l]));
  let suggested = 0;
  let matched = 0;
  const blocks: PreviewBlock[] = [];
  for (const b of data.blocks.slice(0, 8)) {
    const section = (SESSION_SECTIONS as readonly string[]).includes(b?.section) ? (b.section as SessionSection) : null;
    if (!section || !Array.isArray(b.exercises)) continue;
    const items: PreviewItem[] = [];
    for (const e of (b.exercises as RawExercise[]).slice(0, 8)) {
      suggested += 1;
      const hit = typeof e?.name === "string" ? byKey.get(exerciseKey(e.name)) : undefined;
      if (!hit) continue; // not in the library: never invent exercises
      matched += 1;
      items.push({ exerciseId: hit.id, name: hit.name, values: valuesFor(e) });
    }
    if (items.length) blocks.push({ section, items });
  }
  if (blocks.length === 0) return null;
  const title = (typeof data.title === "string" ? data.title : "").trim().slice(0, 160);
  return { title, blocks, matched, suggested };
}
