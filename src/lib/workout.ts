/** Workout document model — shared by the editor, the athlete view and the AI assistant. */
export const FIELD_KEYS = ["reps", "load", "pct1rm", "rpe", "rir", "tempo", "time", "distance", "rest"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];
export type SetRow = Partial<Record<FieldKey, string>>;

export interface WorkoutItem {
  id: string;
  exercise_id: string | null;
  name: string;
  note?: string;
  fields: FieldKey[];
  sets: SetRow[];
}
export type BlockKind = "single" | "superset" | "circuit";
export interface WorkoutBlock { id: string; kind: BlockKind; rounds?: number; items: WorkoutItem[] }
export interface WorkoutSection { id: string; title: string; blocks: WorkoutBlock[] }
export interface WorkoutContent { sections: WorkoutSection[] }

export interface Workout {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  focus: string | null;
  est_minutes: number | null;
  content: WorkoutContent;
  created_by: string | null;
  updated_at: string;
  archived_at: string | null;
}

export interface Exercise {
  id: string;
  club_id: string | null;
  region: string;
  category: string;
  name_en: string;
  name_he: string | null;
  video_id: string | null;
  video_url: string | null;
  equipment: string[];
  cues: string[];
  notes: string | null;
  sort: number;
}

export const FOCI = ["strength", "power", "speed", "conditioning", "mobility", "rtp", "prehab", "mixed"] as const;

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newItem(ex: { id: string | null; name: string }, fields: FieldKey[] = ["reps", "load", "rest"]): WorkoutItem {
  return { id: uid(), exercise_id: ex.id, name: ex.name, fields, sets: [{}, {}, {}] };
}

export function emptyContent(title = ""): WorkoutContent {
  return { sections: [{ id: uid(), title, blocks: [] }] };
}

export function countExercises(c: WorkoutContent) {
  return c.sections.reduce((n, s) => n + s.blocks.reduce((m, b) => m + b.items.length, 0), 0);
}

/** Exercise letter codes like A1, A2, B1 across the whole workout (superset members share a letter). */
export function codes(c: WorkoutContent): Map<string, string> {
  const out = new Map<string, string>();
  let letter = 0;
  for (const s of c.sections) for (const b of s.blocks) {
    const L = String.fromCharCode(65 + (letter++ % 26));
    b.items.forEach((it, i) => out.set(it.id, b.items.length > 1 ? `${L}${i + 1}` : L));
  }
  return out;
}

export function exName(ex: Pick<Exercise, "name_en" | "name_he"> | undefined, lang: string, fallback = "") {
  if (!ex) return fallback;
  return (lang === "he" && ex.name_he) || ex.name_en;
}

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const ytEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
