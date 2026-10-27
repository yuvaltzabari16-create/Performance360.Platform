import type { PersonalData } from "@/lib/assistant/personal";
import type { LiteState } from "./model";

/** Local records in the shape the assistant's data answers expect (the coach sees all of their own athletes). */
export function personalDataFrom(s: LiteState, today: string): PersonalData {
  return {
    today,
    names: Object.fromEntries(s.athletes.map((a) => [a.id, a.name])),
    roster: s.athletes.map((a) => a.id),
    load: s.loads.map((l) => ({ athleteId: l.athleteId, date: l.date, load: l.load })),
    readiness: s.checkIns.map((c) => ({
      athleteId: c.athleteId, date: c.date, sleepQuality: c.sleepQuality, fatigue: c.fatigue, soreness: c.soreness,
      stress: c.stress, mood: c.mood, motivation: c.motivation, pain: c.pain,
    })),
    injuries: s.injuries.filter((i) => i.status === "open").map((i) => ({
      athleteId: i.athleteId, area: i.area, stage: i.stage, injuryDate: i.injuryDate, expectedReturn: i.expectedReturn,
    })),
    wearable: [],
  };
}
