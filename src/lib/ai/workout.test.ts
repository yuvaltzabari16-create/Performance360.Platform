import { describe, expect, it } from "vitest";
import { libraryOutline } from "./prompt";
import { buildPreview, exerciseKey } from "./workout";

const library = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Barbell Front Squat" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Box Jumps" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Cat / Cow" },
];

describe("AI workout validation", () => {
  const raw = {
    title: "  Power day ",
    blocks: [
      { section: "plyometrics", exercises: [{ name: "box jump", sets: 3, reps: "4", restSeconds: 90, rpe: 6 }] },
      { section: "strength", exercises: [{ name: "Barbell Front Squat", sets: 3, reps: "5", loadKg: 60, rpe: 11 }, { name: "Invented Lift", sets: 3 }] },
      { section: "nonsense", exercises: [{ name: "Cat / Cow" }] },
    ],
  };
  it("keeps only library exercises and known sections", () => {
    const p = buildPreview(raw, library)!;
    expect(p.title).toBe("Power day");
    expect(p.blocks.map((b) => b.section)).toEqual(["plyometrics", "strength"]);
    expect(p.blocks[0].items[0]).toMatchObject({ name: "Box Jumps", exerciseId: library[1].id });
    expect(p.suggested).toBe(3);
    expect(p.matched).toBe(2);
  });
  it("normalises names the way the library import does", () => {
    expect(exerciseKey("Box Jumps")).toBe(exerciseKey("box jump"));
  });
  it("passes prescription through the builder parser and drops invalid values", () => {
    const p = buildPreview(raw, library)!;
    expect(p.blocks[0].items[0].values).toEqual({ reps: "3x4", rpe: "6", rest: "90" });
    // RPE 11 is out of range so it is omitted, the rest is kept.
    expect(p.blocks[1].items[0].values).toEqual({ reps: "3x5", load: "60" });
  });
  it("returns null for garbage or when nothing matches", () => {
    expect(buildPreview(null, library)).toBeNull();
    expect(buildPreview({ blocks: "x" }, library)).toBeNull();
    expect(buildPreview({ title: "t", blocks: [{ section: "strength", exercises: [{ name: "Nope" }] }] }, library)).toBeNull();
  });
  it("lists the library compactly for the prompt", () => {
    expect(libraryOutline([{ name: "A", category: "strength" }, { name: "B", category: "strength" }, { name: "C", category: "core" }])).toBe("strength: A; B\ncore: C");
  });
});
