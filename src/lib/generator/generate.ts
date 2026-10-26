import { type ExerciseCategory, type SessionSection } from "@/lib/catalog";
import { parseRequest, type Area, type Focus, type Level, type WorkoutSpec } from "./parse";
import { prescribe } from "./prescribe";

/**
 * Rule-based session builder. Picks exercises from the coach's own library by category, region,
 * level, equipment and body-area rules, then prescribes sets/reps/rest from fixed templates.
 * Same request + same seed always gives the same session. Output feeds `buildPreview`, which
 * re-checks every name against the library, so nothing outside it can reach a session.
 */

export interface LibraryExercise {
  id: string;
  name: string;
  category: string;
  movement_pattern?: string | null;
  primary_muscles?: string[] | null;
  equipment?: string[] | null;
  difficulty?: string | null;
}

interface BlockPlan { section: SessionSection; cats: ExerciseCategory[]; fallback?: ExerciseCategory[]; weight: number; region?: boolean }

const WARM: ExerciseCategory[] = ["warmup", "mobility", "stability"];
const COOL: ExerciseCategory[] = ["recovery", "mobility"];

const PLANS: Record<Focus, BlockPlan[]> = {
  strength: [
    { section: "warmup", cats: WARM, weight: 2 },
    { section: "strength", cats: ["strength"], weight: 5, region: true },
    { section: "core", cats: ["core"], weight: 2 },
    { section: "cooldown", cats: COOL, weight: 1 },
  ],
  power: [
    { section: "warmup", cats: WARM, weight: 2 },
    { section: "plyometrics", cats: ["plyometrics"], weight: 3, region: true },
    { section: "power", cats: ["power", "olympic"], fallback: ["strength"], weight: 3, region: true },
    { section: "core", cats: ["core"], weight: 1 },
    { section: "cooldown", cats: COOL, weight: 1 },
  ],
  speed: [
    { section: "warmup", cats: WARM, weight: 2 },
    { section: "sprint", cats: ["sprint", "acceleration", "max_velocity"], fallback: ["plyometrics"], weight: 3 },
    { section: "cod", cats: ["cod", "deceleration"], weight: 3 },
    { section: "core", cats: ["core"], weight: 1 },
    { section: "cooldown", cats: COOL, weight: 1 },
  ],
  plyometrics: [
    { section: "warmup", cats: WARM, weight: 2 },
    { section: "plyometrics", cats: ["plyometrics"], weight: 5, region: true },
    { section: "core", cats: ["core"], weight: 1 },
    { section: "cooldown", cats: COOL, weight: 1 },
  ],
  mobility: [
    { section: "mobility", cats: ["mobility"], weight: 6 },
    { section: "activation", cats: ["stability"], weight: 2 },
    { section: "recovery", cats: ["recovery", "mobility"], weight: 1 },
  ],
  core: [
    { section: "warmup", cats: WARM, weight: 2 },
    { section: "core", cats: ["core"], weight: 6 },
    { section: "activation", cats: ["stability"], weight: 2 },
    { section: "cooldown", cats: COOL, weight: 1 },
  ],
  conditioning: [
    { section: "warmup", cats: WARM, weight: 2 },
    { section: "conditioning", cats: ["conditioning"], fallback: ["cod", "plyometrics"], weight: 4 },
    { section: "core", cats: ["core"], weight: 2 },
    { section: "cooldown", cats: COOL, weight: 1 },
  ],
  rehab: [
    { section: "activation", cats: ["rehab", "stability"], weight: 4, region: true },
    { section: "strength", cats: ["rehab", "strength"], weight: 3, region: true },
    { section: "core", cats: ["core"], weight: 2 },
    { section: "mobility", cats: ["mobility"], weight: 2 },
  ],
  activation: [
    { section: "warmup", cats: WARM, weight: 3 },
    { section: "activation", cats: ["stability", "core"], weight: 2 },
    { section: "plyometrics", cats: ["plyometrics"], weight: 2, region: true },
  ],
  general: [
    { section: "warmup", cats: WARM, weight: 2 },
    { section: "strength", cats: ["strength"], weight: 4, region: true },
    { section: "plyometrics", cats: ["plyometrics"], weight: 1, region: true },
    { section: "core", cats: ["core"], weight: 2 },
    { section: "cooldown", cats: COOL, weight: 1 },
  ],
};

const LOWER = ["quadriceps", "glutes", "hamstrings", "calves", "adductors", "glute medius", "hips", "knee", "lower body"];
const UPPER = ["shoulders", "shoulder", "chest", "lats", "upper back", "biceps", "triceps", "rotator cuff", "forearm", "elbow", "neck"];

/** Muscles and movement patterns that load each body area. */
const AREA_LOAD: Record<Area, { muscles: string[]; patterns: string[] }> = {
  hamstring: { muscles: ["hamstrings"], patterns: ["hinge", "knee flexion"] },
  quadriceps: { muscles: ["quadriceps"], patterns: ["knee extension", "squat"] },
  groin: { muscles: ["adductors"], patterns: ["hip adduction", "hip abduction"] },
  calf: { muscles: ["calves"], patterns: ["ankle plantarflexion"] },
  ankle: { muscles: ["calves"], patterns: ["ankle", "jump", "change of direction"] },
  knee: { muscles: ["knee"], patterns: ["squat", "jump", "knee extension", "knee flexion"] },
  hip: { muscles: ["hips", "glute medius"], patterns: ["hip abduction", "hip adduction"] },
  back: { muscles: [], patterns: ["hinge", "rotation", "lateral flexion"] },
  shoulder: { muscles: ["shoulders", "shoulder", "rotator cuff"], patterns: ["shoulder", "vertical", "horizontal push", "throw"] },
};

const RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const lc = (s: string) => s.toLowerCase();

/** Small deterministic PRNG so a request and a seed always give the same session. */
function rng(seedText: string) {
  let h = 2166136261;
  for (const ch of seedText) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const touches = (e: LibraryExercise, area: Area) => {
  const load = AREA_LOAD[area];
  const muscles = (e.primary_muscles ?? []).map(lc);
  const pattern = lc(e.movement_pattern ?? "");
  return load.muscles.some((m) => muscles.includes(m)) || load.patterns.some((p) => pattern.includes(p));
};

function allowed(e: LibraryExercise, spec: WorkoutSpec, plan: BlockPlan): boolean {
  const level = RANK[(e.difficulty as Level) ?? "intermediate"] ?? 1;
  const gentle = spec.focus === "rehab" || (spec.focus === "activation" && spec.lowFatigue);
  const cap = plan.section === "warmup" || plan.section === "cooldown" ? 1 : gentle ? Math.min(1, RANK[spec.level]) : RANK[spec.level];
  if (level > cap) return false;
  const gear = (e.equipment ?? []).map(lc);
  if (gear.some((g) => spec.banned.includes(g))) return false;
  if (spec.only && !gear.every((g) => g === "bodyweight" || g === "none" || spec.only!.includes(g))) return false;
  if (spec.focus !== "rehab" && spec.avoid.some((a) => touches(e, a))) return false;
  if (spec.focus === "rehab" && spec.avoid.length === 0 && gear.includes("crutches")) return false;
  if (plan.region && spec.region !== "full") {
    const muscles = (e.primary_muscles ?? []).map(lc);
    const set = spec.region === "lower" ? LOWER : UPPER;
    const tagged = muscles.some((m) => LOWER.includes(m) || UPPER.includes(m));
    if (tagged && !muscles.some((m) => set.includes(m))) return false;
  }
  return true;
}

export interface GeneratedWorkout {
  title: string;
  blocks: { section: SessionSection; exercises: ReturnType<typeof prescribe>[] }[];
}

export function generateWorkout(request: string, library: LibraryExercise[], seed = 0): GeneratedWorkout | null {
  const spec = parseRequest(request);
  const rand = rng(`${request}|${seed}`);
  const plans = PLANS[spec.focus];
  const total = Math.max(4, Math.min(16, Math.round(spec.minutes / 7)));
  const weightSum = plans.reduce((s, p) => s + p.weight, 0);
  const used = new Set<string>();
  const blocks: GeneratedWorkout["blocks"] = [];

  for (const plan of plans) {
    const want = Math.max(1, Math.min(6, Math.round((plan.weight / weightSum) * total)));
    const pool = (cats: ExerciseCategory[]) => library.filter((e) => cats.includes(e.category as ExerciseCategory) && !used.has(e.id) && allowed(e, spec, plan));
    let candidates = pool(plan.cats);
    if (candidates.length < want && plan.fallback) candidates = [...candidates, ...pool(plan.fallback)];
    if (candidates.length === 0) continue;

    // Rehab for a named area: put exercises that train that area first.
    const boosted = (e: LibraryExercise) => (spec.focus === "rehab" && spec.avoid.some((a) => touches(e, a)) ? 0 : 1);
    const shuffled = candidates.map((e) => ({ e, r: rand() })).sort((a, b) => boosted(a.e) - boosted(b.e) || a.r - b.r).map((x) => x.e);

    // Variety first: one exercise per movement pattern, then fill up.
    const picked: LibraryExercise[] = [];
    const patterns = new Set<string>();
    for (const e of shuffled) {
      const p = lc(e.movement_pattern ?? e.name);
      if (!patterns.has(p) && picked.length < want) { patterns.add(p); picked.push(e); }
    }
    for (const e of shuffled) if (picked.length < want && !picked.includes(e)) picked.push(e);

    for (const e of picked) used.add(e.id);
    blocks.push({ section: plan.section, exercises: picked.map((e) => prescribe(e, plan.section, spec)) });
  }
  if (blocks.length === 0) return null;
  return { title: titleFor(spec), blocks };
}

const TITLES: Record<"en" | "he", Record<Focus, string>> = {
  en: { strength: "Strength session", power: "Power session", speed: "Speed and agility session", plyometrics: "Plyometric session", mobility: "Mobility session", core: "Core session", conditioning: "Conditioning session", rehab: "Return-to-training session", activation: "Pre-match activation", general: "Training session" },
  he: { strength: "אימון כוח", power: "אימון עוצמה", speed: "אימון מהירות וזריזות", plyometrics: "אימון פליומטרי", mobility: "אימון ניידות", core: "אימון ליבה", conditioning: "אימון כושר", rehab: "אימון חזרה לפעילות", activation: "הפעלה לפני משחק", general: "אימון" },
};
const MIN: Record<"en" | "he", string> = { en: "min", he: "דק׳" };
const REGION: Record<"en" | "he", Record<string, string>> = { en: { lower: " lower body", upper: " upper body", full: "" }, he: { lower: " פלג גוף תחתון", upper: " פלג גוף עליון", full: "" } };

function titleFor(spec: WorkoutSpec) {
  const l = spec.language;
  return `${TITLES[l][spec.focus]}${REGION[l][spec.region]} · ${spec.minutes} ${MIN[l]}`;
}
