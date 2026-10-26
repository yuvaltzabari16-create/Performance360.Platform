import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { generateSamples } from "./demo";
import { buildHeat, computeMetrics, zoneOf } from "./metrics";
import { parseSamples } from "./samples";
import { parseSummary } from "./summary";
import { DEFAULT_PITCH, type Sample } from "./types";

/** A straight run along the pitch at constant speed, one reading per second. */
const run = (kmh: number, seconds: number): Sample[] =>
  Array.from({ length: seconds + 1 }, (_, t) => ({ t, x: (kmh / 3.6) * t, y: 34, speed: kmh / 3.6, hr: 150 }));

describe("zones", () => {
  it("maps speeds to the five zones", () => {
    expect([3, 10, 17, 22, 28].map(zoneOf)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("computeMetrics", () => {
  it("integrates distance from speed", () => {
    const m = computeMetrics(run(18, 20)); // 5 m/s for 20 s
    expect(m.totalDistanceM).toBe(100);
    expect(m.minutes).toBeCloseTo(0.3, 1);
    expect(m.maxSpeedKmh).toBe(18);
  });
  it("counts high-speed and sprint distance separately", () => {
    const m = computeMetrics(run(27, 10)); // above the sprint threshold
    expect(m.sprintDistanceM).toBe(m.hsrDistanceM);
    expect(m.sprintCount).toBe(1);
    expect(computeMetrics(run(22, 10)).sprintDistanceM).toBe(0);
  });
  it("does not count a sprint shorter than the minimum time", () => {
    const blip: Sample[] = [0, 1, 2, 3, 4].map((t) => ({ t, x: t, y: 0, speed: t === 2 ? 8 : 3, hr: null }));
    expect(computeMetrics(blip).sprintCount).toBe(0);
  });
  it("derives speed from positions when the file has none", () => {
    const noSpeed = run(18, 20).map((s) => ({ ...s, speed: null }));
    expect(computeMetrics(noSpeed).totalDistanceM).toBeGreaterThan(90);
  });
  it("ignores signal gaps and clamps glitches", () => {
    const gap: Sample[] = [{ t: 0, x: 0, y: 0, speed: 5, hr: null }, { t: 60, x: 300, y: 0, speed: 5, hr: null }];
    expect(computeMetrics(gap).totalDistanceM).toBe(0);
    const glitch: Sample[] = [{ t: 0, x: 0, y: 0, speed: 5, hr: null }, { t: 1, x: 5, y: 0, speed: 90, hr: null }];
    expect(computeMetrics(glitch).maxSpeedKmh).toBeLessThanOrEqual(45);
  });
  it("counts accelerations and decelerations", () => {
    const stopGo: Sample[] = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((t, i) => ({ t, x: i, y: 0, speed: [0, 2, 4, 6, 6, 3.5, 1, 0, 0][i], hr: null }));
    const m = computeMetrics(stopGo);
    expect(m.accelCount).toBe(1);
    expect(m.decelCount).toBe(1);
  });
  it("returns zeros for too little data", () => {
    expect(computeMetrics([]).totalDistanceM).toBe(0);
  });
});

describe("buildHeat", () => {
  it("accumulates time in the right cell", () => {
    const stand: Sample[] = [0, 1, 2, 3].map((t) => ({ t, x: 1, y: 1, speed: 0, hr: null }));
    const heat = buildHeat(stand, DEFAULT_PITCH);
    expect(heat.cells[0]).toBe(3);
    expect(heat.cells.reduce((a, b) => a + b, 0)).toBe(3);
  });
  it("clamps positions outside the pitch", () => {
    const outside: Sample[] = [0, 1].map((t) => ({ t, x: 500, y: -20, speed: 0, hr: null }));
    const heat = buildHeat(outside, DEFAULT_PITCH);
    expect(heat.cells[heat.cols - 1]).toBe(1);
  });
});

describe("csv", () => {
  it("handles quotes, semicolons and a byte-order mark", () => {
    const csv = parseCsv('﻿name;note\n"Smith; J";"said ""hi"""\n');
    expect(csv.headers).toEqual(["name", "note"]);
    expect(csv.rows[0]).toEqual(["Smith; J", 'said "hi"']);
  });
});

describe("parseSamples", () => {
  const text = "athlete,time_s,x_m,y_m,speed_kmh,hr\nAmy,0,1,1,0,100\nAmy,1,2,1,10,110\nBen,0,50,30,5,90\nBen,1,52,30,7,95\n";
  it("groups readings per athlete", () => {
    const { players } = parseSamples(text, DEFAULT_PITCH);
    expect([...players.keys()]).toEqual(["Amy", "Ben"]);
    expect(players.get("Amy")![1].speed).toBeCloseTo(10 / 3.6);
  });
  it("rejects files without athlete or time columns", () => {
    expect(() => parseSamples("a,b\n1,2", DEFAULT_PITCH)).toThrow("missing_columns");
  });
  it("fits latitude / longitude into the pitch", () => {
    const geo = "player,timestamp,lat,lon\nA,2026-01-01T10:00:00Z,32.0000,34.0000\nA,2026-01-01T10:00:01Z,32.0005,34.0010\n";
    const { players, warnings } = parseSamples(geo, DEFAULT_PITCH);
    const s = players.get("A")!;
    expect(s[0].t).toBe(0);
    expect(s.every((p) => p.x >= 0 && p.x <= 105 && p.y >= 0 && p.y <= 68)).toBe(true);
    expect(warnings).toContain("positions_fitted");
  });
});

describe("parseSummary", () => {
  it("reads vendor-style headers and kilometres", () => {
    const rows = parseSummary("Player,Total Distance (km),High Speed Running (m),Sprints,Max Speed\nAmy,10.4,812,14,31.2\n");
    expect(rows[0].name).toBe("Amy");
    expect(rows[0].metrics.totalDistanceM).toBe(10400);
    expect(rows[0].metrics.hsrDistanceM).toBe(812);
    expect(rows[0].metrics.maxSpeedKmh).toBe(31.2);
  });
});

describe("generateSamples", () => {
  it("produces a plausible, repeatable session", () => {
    const a = computeMetrics(generateSamples(5, DEFAULT_PITCH, 20));
    const b = computeMetrics(generateSamples(5, DEFAULT_PITCH, 20));
    expect(a).toEqual(b);
    expect(a.totalDistanceM).toBeGreaterThan(1500);
    expect(a.totalDistanceM).toBeLessThan(6000);
    expect(a.maxSpeedKmh).toBeLessThanOrEqual(45);
  });
});
