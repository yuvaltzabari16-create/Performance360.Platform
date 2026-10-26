import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildPreview } from "./preview";
import { generateWorkout, type LibraryExercise } from "./generate";
import { parseRequest } from "./parse";

const rows = JSON.parse(readFileSync("supabase/data/exercise-library.json", "utf8")) as Omit<LibraryExercise, "id">[];
const library: LibraryExercise[] = rows.map((r, i) => ({ ...r, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));

describe("parseRequest", () => {
  it("reads English requests", () => {
    const s = parseRequest("60-minute lower-body power session for a U19 footballer, MD-2. No barbell.");
    expect(s).toMatchObject({ focus: "power", region: "lower", minutes: 60, language: "en" });
    expect(s.banned).toContain("barbell");
  });
  it("reads dumbbells only and injury areas", () => {
    expect(parseRequest("45-minute upper-body strength session, dumbbells only").only).toEqual(["dumbbell"]);
    const r = parseRequest("Return-to-play lower-body session after a hamstring strain, conservative");
    expect(r.focus).toBe("rehab");
    expect(r.avoid).toContain("hamstring");
    expect(r.lowFatigue).toBe(true);
  });
  it("reads Hebrew requests", () => {
    const s = parseRequest("אימון כוח פלג גוף תחתון 45 דקות ללא מוט");
    expect(s).toMatchObject({ focus: "strength", region: "lower", minutes: 45, language: "he" });
    expect(s.banned).toContain("barbell");
    expect(parseRequest("שיקום אחרי פציעה בירך אחורית").avoid).toContain("hamstring");
  });
});

describe("generateWorkout", () => {
  const ask = (text: string, seed = 0) => generateWorkout(text, library, seed);

  it("is deterministic and varies with the seed", () => {
    expect(ask("Lower body strength 60 min")).toEqual(ask("Lower body strength 60 min"));
    expect(ask("Lower body strength 60 min", 1)).not.toEqual(ask("Lower body strength 60 min", 2));
  });
  it("only uses library exercises and passes buildPreview untouched", () => {
    for (const text of ["Lower body power 60 min", "Speed and agility 45 min", "Core 30 min", "Mobility session", "אימון כוח 60 דקות", "Pre-match activation, 25 minutes, low fatigue"]) {
      const g = ask(text)!;
      const preview = buildPreview(g, library)!;
      expect(preview.matched).toBe(preview.suggested);
      expect(preview.blocks.length).toBeGreaterThan(0);
    }
  });
  it("respects equipment rules", () => {
    const names = new Map(library.map((l) => [l.name, l]));
    const g = ask("Upper body strength, dumbbells only")!;
    for (const b of g.blocks) for (const e of b.exercises) {
      const gear = names.get(e.name)!.equipment ?? [];
      expect(gear.every((x) => x === "bodyweight" || x === "dumbbell")).toBe(true);
    }
    const nb = ask("Lower body strength, no barbell")!;
    for (const b of nb.blocks) for (const e of b.exercises) expect(names.get(e.name)!.equipment ?? []).not.toContain("barbell");
  });
  it("keeps jumps and sprints out of a return-to-play session", () => {
    const g = ask("Return-to-play after a knee injury")!;
    expect(g.blocks.map((b) => b.section)).not.toContain("plyometrics");
    expect(g.blocks.map((b) => b.section)).not.toContain("sprint");
  });
  it("never repeats an exercise and caps block size", () => {
    const g = ask("Full body strength 90 minutes")!;
    const all = g.blocks.flatMap((b) => b.exercises.map((e) => e.name));
    expect(new Set(all).size).toBe(all.length);
    for (const b of g.blocks) expect(b.exercises.length).toBeLessThanOrEqual(8);
  });
  it("titles in the language of the request", () => {
    expect(ask("אימון כוח 60 דקות")!.title).toContain("אימון כוח");
    expect(ask("Strength 60 min")!.title).toContain("Strength session");
  });
});
