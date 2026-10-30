import { describe, expect, it } from "vitest";
import { dailySeries, dayTotals, isIsoDay, isMealPhotoName, shiftDay, sortMeals, type MealRow } from "./nutrition";

const meal = (p: Partial<MealRow>): MealRow => ({ id: "m", eaten_on: "2026-10-30", meal_type: "lunch", description: "x", calories: null, protein_g: null, carbs_g: null, fat_g: null, water_ml: null, photo_id: null, coach_comment: null, created_at: "2026-10-30T12:00:00Z", ...p });

describe("nutrition", () => {
  it("adds up only what was entered", () => {
    expect(dayTotals([meal({ calories: 500, protein_g: "30.25" }), meal({ calories: 200, fat_g: 10, water_ml: 500 }), meal({})])).toEqual({ meals: 3, calories: 700, protein: 30.3, carbs: 0, fat: 10, water: 500 });
  });
  it("orders meals through the day", () => {
    const sorted = sortMeals([meal({ meal_type: "dinner" }), meal({ meal_type: "breakfast" }), meal({ meal_type: "post_training" })]);
    expect(sorted.map((m) => m.meal_type)).toEqual(["breakfast", "post_training", "dinner"]);
  });
  it("builds a week of days ending today, empty days included", () => {
    const s = dailySeries([meal({ eaten_on: "2026-10-30", calories: 800 }), meal({ eaten_on: "2026-10-28", calories: 300 }), meal({ eaten_on: "2026-10-01", calories: 999 })], "2026-10-30");
    expect(s).toHaveLength(7);
    expect(s[0].day).toBe("2026-10-24");
    expect(s.map((d) => d.calories)).toEqual([0, 0, 0, 0, 300, 0, 800]);
  });
  it("moves across month ends and checks dates and photo names", () => {
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(isIsoDay("2026-02-30x")).toBe(false);
    expect(isIsoDay("2026-10-30")).toBe(true);
    expect(isMealPhotoName("plate.JPG")).toBe(true);
    expect(isMealPhotoName("menu.pdf")).toBe(false);
  });
});
