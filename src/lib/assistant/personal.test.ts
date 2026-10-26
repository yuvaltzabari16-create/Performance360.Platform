import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/en";
import he from "@/lib/i18n/he";
import { detectIntent, needs, personalAnswer, type PersonalData } from "./personal";
import { ASSISTANT_ROLES } from "./roles";

const TODAY = "2026-10-26";
const day = (n: number) => new Date(Date.parse(TODAY) - n * 86_400_000).toISOString().slice(0, 10);
const A = "a1", B = "b2";
const base = (over: Partial<PersonalData> = {}): PersonalData => ({ today: TODAY, names: { [A]: "Ari Athlete", [B]: "Ben Back" }, roster: [A, B], load: [], readiness: [], injuries: [], wearable: [], ...over });
/** Steady 100 a day for 4 weeks, then a spike. */
const steady = (id: string, spike: number) => [
  ...Array.from({ length: 28 }, (_, i) => ({ athleteId: id, date: day(i + 7), load: 100 })),
  ...Array.from({ length: 7 }, (_, i) => ({ athleteId: id, date: day(i), load: spike })),
];
const row = (id: string, d: string, n: number, pain = false) => ({ athleteId: id, date: d, sleepQuality: n, fatigue: 6 - n, soreness: 6 - n, stress: 6 - n, mood: n, motivation: n, pain });

describe("detectIntent", () => {
  it("recognises athletes asking for their own numbers, in both languages", () => {
    expect(detectIntent("How is my workload this week?", false)).toBe("workload");
    expect(detectIntent("Show my readiness", false)).toBe("readiness");
    expect(detectIntent("what is my recovery today", false)).toBe("recovery");
    expect(detectIntent("do I have any injuries recorded", false)).toBeNull();
    expect(detectIntent("show my injuries", false)).toBe("injuries");
    expect(detectIntent("how am I doing", false)).toBe("summary");
    expect(detectIntent("מה העומס שלי", false)).toBe("workload");
    expect(detectIntent("איך אני", false)).toBe("summary");
  });
  it("recognises staff asking about their athletes", () => {
    expect(detectIntent("Who is at risk this week?", true)).toBe("alerts");
    expect(detectIntent("which athletes have a high workload", true)).toBe("workload");
    expect(detectIntent("who has not checked in today", true)).toBe("readiness");
    expect(detectIntent("who is injured", true)).toBe("injuries");
    expect(detectIntent("show alerts", true)).toBe("alerts");
    expect(detectIntent("מי בסיכון", true)).toBe("alerts");
    expect(detectIntent("אילו ספורטאים עם עומס גבוה", true)).toBe("workload");
  });
  it("leaves general questions to the knowledge base", () => {
    for (const q of ["What are the limits of acute:chronic workload ratios?", "How can I recover better between a match and the next training?", "How do I explain workload to a player?", "What is HRV?"]) {
      expect(detectIntent(q, true), q).toBeNull();
      expect(detectIntent(q, false), q).toBeNull();
    }
  });
  it("never turns a suggested starter question into a data lookup", () => {
    for (const dict of [en, he]) {
      const starters = dict.assistant.starters as Record<string, string[]>;
      for (const role of ASSISTANT_ROLES) for (const q of starters[role]) expect(detectIntent(q, role !== "athlete"), q).toBeNull();
    }
  });
});

describe("needs", () => {
  it("loads only what a question needs", () => {
    expect(needs("injuries")).toEqual({ load: false, readiness: false, injuries: true, wearable: false });
    expect(needs("summary")).toEqual({ load: true, readiness: true, injuries: true, wearable: true });
  });
});

describe("athlete answers", () => {
  it("reports the workload ratio with the app's thresholds", () => {
    const text = personalAnswer("workload", false, base({ load: steady(A, 200) }), "en");
    expect(text).toContain("ratio is **1.6**");
    expect(text).toContain("higher than usual");
    expect(text).toContain("not a diagnosis");
    expect(personalAnswer("workload", false, base({ load: steady(A, 100) }), "en")).toContain("usual range");
  });
  it("says so when there is not enough data", () => {
    expect(personalAnswer("workload", false, base(), "en")).toContain("no GPS sessions");
    expect(personalAnswer("readiness", false, base(), "en")).toContain("Readiness");
    expect(personalAnswer("recovery", false, base(), "en")).toContain("Wearables");
    expect(personalAnswer("injuries", false, base(), "en")).toContain("no open injuries");
  });
  it("flags a check-in well below the athlete's own average and mentions pain", () => {
    const rows = [row(A, day(0), 1, true), ...[1, 2, 3, 4, 5].map((i) => row(A, day(i), 5))];
    const text = personalAnswer("readiness", false, base({ readiness: rows }), "en");
    expect(text).toContain("below your own average");
    expect(text).toContain("reported pain");
  });
  it("reports injuries with days out and the return date", () => {
    const text = personalAnswer("injuries", false, base({ injuries: [{ athleteId: A, area: "hamstring", stage: "running", injuryDate: day(10), expectedReturn: day(-5) }] }), "en");
    expect(text).toContain("hamstring");
    expect(text).toContain("stage running");
    expect(text).toContain("10 days");
    expect(text).toContain("expected back in 5 days");
  });
  it("reports the latest wearable reading and a low-recovery note", () => {
    const text = personalAnswer("recovery", false, base({ wearable: [{ athleteId: A, day: day(0), recovery: 20, hrv: 55.4, sleepHours: 6.5, restingHr: 52 }] }), "en");
    expect(text).toContain("recovery **20%**");
    expect(text).toContain("HRV **55.4 ms**");
    expect(text).toContain("Recovery is low today");
  });
  it("answers in Hebrew", () => {
    const text = personalAnswer("workload", false, base({ load: steady(A, 200) }), "he");
    expect(text).toContain("עומס");
    expect(text).toContain("גבוה מהרגיל");
  });
  it("builds an overview from every section", () => {
    const text = personalAnswer("summary", false, base(), "en");
    for (const h of ["Wellness check-ins", "Training load", "Recovery and sleep", "Injuries"]) expect(text).toContain(h);
  });
});

describe("staff answers", () => {
  it("lists alerts with names, most urgent first", () => {
    const d = base({ load: [...steady(A, 200), ...steady(B, 100)], wearable: [{ athleteId: B, day: day(0), recovery: 20, hrv: null, sleepHours: null, restingHr: null }] });
    const text = personalAnswer("alerts", true, d, "en");
    expect(text).toContain("**Ari Athlete**: workload ratio 1.6");
    expect(text).toContain("**Ben Back**: shared recovery 20%");
    expect(text.indexOf("Ari Athlete")).toBeLessThan(text.indexOf("Ben Back"));
  });
  it("says there is nothing to report when everything is fine", () => {
    expect(personalAnswer("alerts", true, base(), "en")).toContain("No workload or recovery alerts");
  });
  it("lists who has not checked in and who is flagged today", () => {
    const d = base({ readiness: [row(A, day(0), 1, true), ...[1, 2, 3, 4].map((i) => row(A, day(i), 5))] });
    const text = personalAnswer("readiness", true, d, "en");
    expect(text).toContain("Checked in today: 1 of 2");
    expect(text).toContain("**Ari Athlete**");
    expect(text).toContain("pain reported");
    expect(text).toContain("Not yet checked in: Ben Back");
  });
  it("lists open injuries and notes an overdue return date", () => {
    const text = personalAnswer("injuries", true, base({ injuries: [{ athleteId: B, area: "knee", stage: "rehab", injuryDate: day(30), expectedReturn: day(3) }] }), "en");
    expect(text).toContain("1 open injuries");
    expect(text).toContain("**Ben Back**: knee");
    expect(text).toContain("expected return passed 3 days ago");
  });
  it("explains that wearable data appears only when athletes share it", () => {
    expect(personalAnswer("recovery", true, base(), "en")).toContain("decide whether to share");
  });
  it("answers in Hebrew", () => {
    expect(personalAnswer("injuries", true, base({ injuries: [{ athleteId: B, area: "knee", stage: "rehab", injuryDate: day(30), expectedReturn: null }] }), "he")).toContain("ברך");
  });
});
