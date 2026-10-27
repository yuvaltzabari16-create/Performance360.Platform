import { describe, expect, it } from "vitest";
import { personalAnswer, detectIntent } from "@/lib/assistant/personal";
import { personalDataFrom } from "./bridge";
import {
  csvCell, emptyState, exportJson, parseImport, parseLoadCsv, removeAthlete, saveCheckIn, sanitizeState, setInjuryStage, SCHEMA_VERSION,
  type Athlete, type CheckIn, type Injury, type LiteState,
} from "./model";

const A: Athlete = { id: "a1", name: "Ari Athlete", sport: "Football", position: "", notes: "", createdAt: "2026-01-01T00:00:00.000Z" };
const B: Athlete = { id: "b2", name: "Ben Back", sport: "", position: "", notes: "", createdAt: "2026-01-01T00:00:00.000Z" };
const checkIn = (athleteId: string, date: string, q = 4): CheckIn => ({ id: `${athleteId}-${date}`, athleteId, date, sleepHours: 7, sleepQuality: q, fatigue: 6 - q, soreness: 6 - q, stress: 6 - q, mood: q, motivation: q, pain: false, painNote: "" });
const injury: Injury = { id: "i1", athleteId: "a1", area: "hamstring", injuryDate: "2026-10-01", expectedReturn: null, stage: "rest", status: "open", note: "", events: [] };
const full = (): LiteState => ({
  ...emptyState("en"), athletes: [A, B], checkIns: [checkIn("a1", "2026-10-20")], injuries: [injury],
  tests: [{ id: "t1", athleteId: "a1", date: "2026-10-01", name: "CMJ", unit: "cm", value: 38.5, higherIsBetter: true }],
  loads: [{ id: "l1", athleteId: "a1", date: "2026-10-20", load: 400 }],
  programs: [{ id: "p1", title: "Block", createdAt: "2026-10-01T00:00:00.000Z", sessions: [{ id: "s1", title: "Day 1", items: [{ id: "x1", exerciseId: "lib-1", name: "Goblet Squat", section: "strength", values: { reps: "3x8", rpe: "7" } }] }] }],
});

describe("export and import", () => {
  it("round-trips everything", () => {
    const s = full();
    const r = parseImport(exportJson(s));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.athletes).toEqual(s.athletes);
      expect(r.state.checkIns).toEqual(s.checkIns);
      expect(r.state.injuries).toEqual(s.injuries);
      expect(r.state.programs).toEqual(s.programs);
      expect(r.counts).toEqual({ athletes: 2, programs: 1 });
    }
  });
  it("refuses files that are not ours", () => {
    expect(parseImport("not json")).toEqual({ ok: false, error: "not_json" });
    expect(parseImport("{}")).toEqual({ ok: false, error: "empty" });
    expect(parseImport(JSON.stringify({ version: SCHEMA_VERSION + 1, athletes: [] }))).toEqual({ ok: false, error: "too_new" });
  });
  it("drops records of unknown athletes and clamps bad values", () => {
    const s = sanitizeState({
      athletes: [{ id: "a1", name: "  Ari  " }, { id: "a2", name: "" }],
      checkIns: [{ athleteId: "a1", date: "2026-10-01", sleepQuality: 9, fatigue: 3, pain: "yes" }, { athleteId: "zz", date: "2026-10-01" }, { athleteId: "a1", date: "bad" }],
      injuries: [{ athleteId: "a1", injuryDate: "2026-10-01", area: "wing", stage: "flying", status: "weird" }],
      loads: [{ athleteId: "a1", date: "2026-10-01", load: -5 }, { athleteId: "a1", date: "2026-10-02", load: 300 }],
    });
    expect(s.athletes.map((a) => a.name)).toEqual(["Ari"]);
    expect(s.checkIns).toHaveLength(1);
    expect(s.checkIns[0]).toMatchObject({ sleepQuality: null, fatigue: 3, pain: false });
    expect(s.injuries[0]).toMatchObject({ area: "other", stage: "rest", status: "open" });
    expect(s.loads.map((l) => l.load)).toEqual([300]);
  });
  it("keeps only known prescription fields and sections in imported programs", () => {
    const s = sanitizeState({ programs: [{ title: "P", sessions: [{ title: "S", items: [{ name: "Squat", section: "nonsense", values: { reps: "3x5", evil: "<script>", rpe: 7 } }] }] }] });
    const item = s.programs[0].sessions[0].items[0];
    expect(item.section).toBe("strength");
    expect(item.values).toEqual({ reps: "3x5" });
  });
});

describe("records", () => {
  it("removing an athlete removes everything recorded for them", () => {
    const s = removeAthlete(full(), "a1");
    expect(s.athletes.map((a) => a.id)).toEqual(["b2"]);
    expect([s.checkIns, s.tests, s.injuries, s.loads].every((l) => l.length === 0)).toBe(true);
    expect(s.programs).toHaveLength(1);
  });
  it("one check-in per athlete and day", () => {
    const s = saveCheckIn(saveCheckIn(emptyState(), checkIn("a1", "2026-10-20", 2)), checkIn("a1", "2026-10-20", 5));
    expect(s.checkIns).toHaveLength(1);
    expect(s.checkIns[0].sleepQuality).toBe(5);
  });
  it("clearing an injury needs a written basis", () => {
    expect(setInjuryStage(injury, "cleared", " ")).toEqual({ error: "note_required" });
    expect(setInjuryStage(injury, "rest", "x")).toEqual({ error: "same_stage" });
    const moved = setInjuryStage(injury, "rehab", "");
    expect(moved).toMatchObject({ stage: "rehab", status: "open" });
    const done = setInjuryStage(injury, "cleared", "Cleared by the physio after testing", new Date("2026-10-26T10:00:00Z"));
    expect(done).toMatchObject({ stage: "cleared", status: "resolved" });
    expect((done as Injury).events[0]).toMatchObject({ at: "2026-10-26T10:00:00.000Z", stage: "cleared" });
  });
});

describe("csv", () => {
  it("imports load rows for known athletes only", () => {
    const { rows, skipped } = parseLoadCsv("athlete,date,load\nAri Athlete,2026-10-20,450\nari athlete;2026-10-21;300.5\nNobody,2026-10-20,100\nBen Back,20/10/2026,100\n", [A, B]);
    expect(rows.map((r) => [r.athleteId, r.date, r.load])).toEqual([["a1", "2026-10-20", 450], ["a1", "2026-10-21", 300.5]]);
    expect(skipped).toBe(2);
  });
  it("defuses spreadsheet formulas and quotes separators", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(null)).toBe("");
  });
});

describe("assistant bridge", () => {
  it("lets the assistant answer from the local records", () => {
    const d = personalDataFrom(full(), "2026-10-26");
    expect(d.names).toEqual({ a1: "Ari Athlete", b2: "Ben Back" });
    expect(detectIntent("who has not checked in today", true)).toBe("readiness");
    const text = personalAnswer("readiness", true, d, "en");
    expect(text).toContain("Not yet checked in");
    expect(text).toContain("Ari Athlete");
    expect(personalAnswer("injuries", true, d, "en")).toContain("**Ari Athlete**: hamstring");
  });
});
