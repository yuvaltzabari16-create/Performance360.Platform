import { useEffect, useState } from "react";
import cats from "./exerciseCategories.json";
import { must, supabase } from "./supabase";
import type { Exercise } from "./workout";

export const CATEGORIES = cats.categories as { key: string; en: string; he: string }[];
export const REGIONS = ["lower", "upper", "core", "rehab"] as const;
export const CATEGORY_REGION: Record<string, string> = {
  squat: "lower", hinge: "lower", quad: "lower", hamstring: "lower", adductor: "lower", abductor: "lower", calf: "lower", plyo: "lower", cod: "lower",
  hpress: "upper", hrow: "upper", vpress: "upper", vpull: "upper", arms: "upper", forearm: "upper", shoulder: "upper", rom: "upper", iso: "upper", medball: "upper",
  plank: "core", sidebend: "core", flexpelvis: "core", flexrib: "core", rotation: "core",
  knee_flex: "rehab", knee_ext: "rehab", quad_start: "rehab", gait: "rehab", rehab_other: "rehab",
};

export function categoryName(key: string, lang: string) {
  const c = CATEGORIES.find((x) => x.key === key);
  return c ? (lang === "he" ? c.he : c.en) : key;
}

/** Extract an 11-char YouTube id from a watch / short / embed / youtu.be URL. */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// The library is ~350 rows and rarely changes: load once per session, refresh after edits.
let cache: Promise<Exercise[]> | null = null;
const listeners = new Set<(e: Exercise[]) => void>();

export function loadExercises(force = false): Promise<Exercise[]> {
  if (!cache || force) {
    cache = (async () => must(await supabase.from("exercises").select("*").is("archived_at", null).order("sort")) as Exercise[])();
    cache.then((list) => listeners.forEach((l) => l(list))).catch(() => { cache = null; });
  }
  return cache;
}

export function useExercises() {
  const [list, setList] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const on = (e: Exercise[]) => live && setList(e);
    listeners.add(on);
    loadExercises().then(on).catch((e) => live && setError(String(e?.message ?? e)));
    return () => { live = false; listeners.delete(on); };
  }, []);
  return { list, error, byId: new Map((list ?? []).map((e) => [e.id, e])) };
}
