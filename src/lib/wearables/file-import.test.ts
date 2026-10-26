import { describe, expect, it } from "vitest";
import { parseWearableFiles } from "./file-import";

describe("WHOOP export", () => {
  const csv = [
    'Cycle start time,Cycle end time,Cycle timezone,Recovery score %,Resting heart rate (bpm),Heart rate variability (ms),Skin temp (celsius),Blood oxygen %,Day Strain,Max HR (bpm),Average HR (bpm),Sleep performance %,Asleep duration (min)',
    '2026-10-20 06:30:12,2026-10-21 06:41:00,UTC+02:00,72,51,64.3,33.2,96.4,12.3,168,71,88,390',
    '2026-10-21 06:41:00,2026-10-22 06:35:00,UTC+02:00,45,56,50.1,33.4,95.8,15.9,181,76,70,372',
  ].join("\n");
  it("maps the cycle export to daily rows", () => {
    const r = parseWearableFiles([{ name: "physiological_cycles.csv", text: csv }], "whoop");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ day: "2026-10-20", recovery_score: 72, resting_hr: 51, hrv_ms: 64.3, strain: 12.3, sleep_performance: 88, sleep_hours: 6.5, avg_hr: 71, max_hr: 168, spo2: 96.4 });
    expect(r.recognized).toEqual(["physiological_cycles.csv"]);
  });
});

describe("Fitbit export", () => {
  const sleep = JSON.stringify([{ dateOfSleep: "2026-10-20", minutesAsleep: 420, efficiency: 91, isMainSleep: true }, { dateOfSleep: "2026-10-20", minutesAsleep: 30, efficiency: 70, isMainSleep: false }]);
  const rhr = JSON.stringify([{ dateTime: "10/20/26 00:00:00", value: { date: "2026-10-20", value: 52.34, error: 1 } }, { dateTime: "10/21/26 00:00:00", value: { date: "2026-10-21", value: 0, error: 1 } }]);
  const hrv = "timestamp,rmssd,nremhr,entropy\n2026-10-20T00:00:00,48.2,50.1,2.5\n";
  it("merges sleep, resting heart rate and HRV from separate files", () => {
    const r = parseWearableFiles([{ name: "sleep-2026-10-20.json", text: sleep }, { name: "resting_heart_rate-2026-10-20.json", text: rhr }, { name: "Daily Heart Rate Variability Summary - 2026-10.csv", text: hrv }], "fitbit");
    expect(r.rows).toEqual([{ day: "2026-10-20", sleep_hours: 7, sleep_performance: 91, resting_hr: 52.3, hrv_ms: 48.2 }]);
    expect(r.ignored).toEqual([]);
  });
  it("does not read Fitbit JSON as WHOOP data", () => {
    expect(parseWearableFiles([{ name: "sleep.json", text: sleep }], "whoop").ignored).toEqual(["sleep.json"]);
  });
});

describe("generic template and unknown files", () => {
  it("reads the plain CSV template, including decimal commas in a semicolon file", () => {
    const r = parseWearableFiles([{ name: "mine.csv", text: "date;hrv_ms;resting_hr;sleep_hours\n2026-10-20;55,5;50;7,25\n" }], "fitbit");
    expect(r.rows[0]).toEqual({ day: "2026-10-20", hrv_ms: 55.5, resting_hr: 50, sleep_hours: 7.25 });
  });
  it("lists files it cannot read instead of guessing", () => {
    const r = parseWearableFiles([{ name: "notes.txt", text: "hello" }, { name: "bad.json", text: "{ nope" }], "fitbit");
    expect(r.rows).toEqual([]);
    expect(r.ignored).toEqual(["notes.txt", "bad.json"]);
  });
});
