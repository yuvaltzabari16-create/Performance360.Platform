/** Meal logging: meal types in day order, daily totals and a per-day series for charts. */

export const MEAL_TYPES = ["breakfast", "pre_training", "lunch", "post_training", "snack", "dinner"] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export const isMealType = (v: string | null | undefined): v is MealType => (MEAL_TYPES as readonly string[]).includes(v ?? "");

export const MEAL_PHOTO_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;
export const isMealPhotoName = (name: string) => (MEAL_PHOTO_EXTENSIONS as readonly string[]).includes(name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");

export interface MealRow {
  id: string;
  eaten_on: string;
  meal_type: MealType;
  description: string;
  calories: number | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  water_ml: number | null;
  photo_id: string | null;
  coach_comment: string | null;
  created_at: string;
}

export interface DayTotals { meals: number; calories: number; protein: number; carbs: number; fat: number; water: number }

const n = (v: number | string | null) => (v == null || v === "" ? 0 : Number(v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Sums what was entered; meals without a figure add nothing (no estimates). */
export function dayTotals(meals: Pick<MealRow, "calories" | "protein_g" | "carbs_g" | "fat_g" | "water_ml">[]): DayTotals {
  const t = meals.reduce((s, m) => ({
    meals: s.meals + 1, calories: s.calories + n(m.calories), protein: s.protein + n(m.protein_g), carbs: s.carbs + n(m.carbs_g), fat: s.fat + n(m.fat_g), water: s.water + n(m.water_ml),
  }), { meals: 0, calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 });
  return { ...t, protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) };
}

/** Meals of a day in meal order, then by when they were logged. */
export function sortMeals<T extends Pick<MealRow, "meal_type" | "created_at">>(meals: T[]): T[] {
  return [...meals].sort((a, b) => MEAL_TYPES.indexOf(a.meal_type) - MEAL_TYPES.indexOf(b.meal_type) || a.created_at.localeCompare(b.created_at));
}

export function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

export const isIsoDay = (v: string | null | undefined): v is string => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "") && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** One point per day for the `days` days ending on `end`, including days with nothing logged. */
export function dailySeries(meals: MealRow[], end: string, days = 7): { label: string; day: string; calories: number; protein: number; meals: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const day = shiftDay(end, i - days + 1);
    const t = dayTotals(meals.filter((m) => m.eaten_on === day));
    return { label: day.slice(5), day, calories: t.calories, protein: t.protein, meals: t.meals };
  });
}
