import { ACCEL_MIN_SECONDS, ACCEL_THRESHOLD, HEAT_COLS, HEAT_ROWS, HSR_KMH, MAX_GAP_SECONDS, MAX_PLAUSIBLE_KMH, SPRINT_KMH, SPRINT_MIN_SECONDS, ZONE_COUNT, ZONE_LIMITS_KMH } from "./constants";
import type { GpsMetrics, HeatGrid, PitchSize, Sample } from "./types";

const KMH = 3.6;

/** Index 0..4 of the speed zone for a speed in km/h. */
export function zoneOf(kmh: number): number {
  const i = ZONE_LIMITS_KMH.findIndex((limit) => kmh < limit);
  return i === -1 ? ZONE_COUNT - 1 : i;
}

/** Speed in m/s for each sample, derived from positions when the file has none. Glitches are capped. */
function speeds(samples: Sample[]): number[] {
  return samples.map((s, i) => {
    let v = s.speed;
    if (v == null) {
      const p = samples[i - 1];
      const dt = p ? s.t - p.t : 0;
      v = p && dt > 0 && dt <= MAX_GAP_SECONDS ? Math.hypot(s.x - p.x, s.y - p.y) / dt : 0;
    }
    return Math.min(Math.max(v, 0), MAX_PLAUSIBLE_KMH / KMH);
  });
}

/** Counts runs where the predicate holds for at least `minSeconds` of continuous readings. */
function countEfforts(times: number[], active: boolean[], minSeconds: number): number {
  let count = 0;
  let start: number | null = null;
  for (let i = 0; i < active.length; i++) {
    const continues = active[i] && (i === 0 || times[i] - times[i - 1] <= MAX_GAP_SECONDS);
    if (active[i] && start === null) start = times[i];
    else if (!continues && start !== null) {
      if (times[i - 1] - start >= minSeconds) count++;
      start = active[i] ? times[i] : null;
    }
    if (start !== null && i === active.length - 1 && times[i] - start >= minSeconds) count++;
  }
  return count;
}

/** Time spent in each pitch cell. Positions outside the pitch are clamped to its edge. */
export function buildHeat(samples: Sample[], pitch: PitchSize, cols = HEAT_COLS, rows = HEAT_ROWS): HeatGrid {
  const cells = new Array<number>(cols * rows).fill(0);
  for (let i = 0; i < samples.length; i++) {
    const dt = i > 0 ? samples[i].t - samples[i - 1].t : 0;
    if (dt <= 0 || dt > MAX_GAP_SECONDS) continue;
    const c = Math.min(cols - 1, Math.max(0, Math.floor((samples[i].x / pitch.length) * cols)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor((samples[i].y / pitch.width) * rows)));
    cells[r * cols + c] += dt;
  }
  return { cols, rows, cells: cells.map((v) => Math.round(v * 10) / 10) };
}

/** All session metrics for one athlete from their raw readings. */
export function computeMetrics(input: Sample[]): GpsMetrics {
  const samples = [...input].sort((a, b) => a.t - b.t);
  const empty: GpsMetrics = { minutes: 0, totalDistanceM: 0, hsrDistanceM: 0, sprintDistanceM: 0, sprintCount: 0, maxSpeedKmh: 0, accelCount: 0, decelCount: 0, playerLoad: 0, avgHr: null, maxHr: null, zones: new Array(ZONE_COUNT).fill(0) };
  if (samples.length < 2) return empty;
  const v = speeds(samples);
  const times = samples.map((s) => s.t);
  const zones = new Array<number>(ZONE_COUNT).fill(0);
  const accel: number[] = [0];
  let speedChange = 0;
  for (let i = 1; i < samples.length; i++) {
    const dt = times[i] - times[i - 1];
    if (dt <= 0 || dt > MAX_GAP_SECONDS) { accel.push(0); continue; }
    zones[zoneOf(v[i] * KMH)] += v[i] * dt;
    accel.push((v[i] - v[i - 1]) / dt);
    speedChange += Math.abs(v[i] - v[i - 1]);
  }
  const total = zones.reduce((a, b) => a + b, 0);
  const hrs = samples.map((s) => s.hr).filter((h): h is number => h != null && h > 30 && h < 230);
  const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
  return {
    minutes: round((times[times.length - 1] - times[0]) / 60, 1),
    totalDistanceM: round(total),
    hsrDistanceM: round(zones[3] + zones[4]),
    sprintDistanceM: round(zones[4]),
    sprintCount: countEfforts(times, v.map((s) => s * KMH >= SPRINT_KMH), SPRINT_MIN_SECONDS),
    maxSpeedKmh: round(Math.max(...v) * KMH, 1),
    accelCount: countEfforts(times, accel.map((a) => a >= ACCEL_THRESHOLD), ACCEL_MIN_SECONDS),
    decelCount: countEfforts(times, accel.map((a) => a <= -ACCEL_THRESHOLD), ACCEL_MIN_SECONDS),
    playerLoad: round(speedChange / 10, 1),
    avgHr: hrs.length ? round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
    maxHr: hrs.length ? Math.max(...hrs) : null,
    zones: zones.map((z) => round(z)),
  };
}

export { HSR_KMH };
