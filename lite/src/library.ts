import raw from "../../supabase/data/exercise-library.json";
import type { LibraryExercise } from "@/lib/generator/generate";

interface RawExercise {
  name: string; category: string; movement_pattern?: string | null; primary_muscles?: string[]; equipment?: string[];
  difficulty?: string; video_url?: string | null;
}

export interface LibraryItem extends LibraryExercise { video_url: string | null }

/** The 347 exercises of the shared app's library, with stable ids by position. */
export const LIBRARY: LibraryItem[] = (raw as RawExercise[]).map((e, i) => ({
  id: `lib-${i}`, name: e.name, category: e.category, movement_pattern: e.movement_pattern ?? null,
  primary_muscles: e.primary_muscles ?? [], equipment: e.equipment ?? [], difficulty: e.difficulty ?? "intermediate",
  video_url: typeof e.video_url === "string" && /^https:\/\//.test(e.video_url) ? e.video_url : null,
}));

export const CATEGORIES = [...new Set(LIBRARY.map((e) => e.category))].sort();
export const EQUIPMENT = [...new Set(LIBRARY.flatMap((e) => e.equipment ?? []))].sort();
