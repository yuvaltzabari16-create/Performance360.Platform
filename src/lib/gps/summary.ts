import { findColumn, parseCsv, toNumber } from "./csv";
import type { GpsMetrics } from "./types";

export interface SummaryRow {
  name: string;
  metrics: GpsMetrics;
}

const COL = {
  athlete: ["athlete", "player", "name", "playername", "athletename"],
  minutes: ["minutes", "duration_min", "durationmin", "duration", "timeplayed", "mins"],
  distance: ["total_distance_m", "totaldistance", "totaldistancem", "distance", "distancem", "distance_m"],
  hsr: ["hsr_distance_m", "hsr", "hsrdistance", "highspeedrunning", "highspeeddistance", "hsrm"],
  sprintDist: ["sprint_distance_m", "sprintdistance", "sprintdistancem"],
  sprints: ["sprint_count", "sprints", "numberofsprints", "sprintcount"],
  maxSpeed: ["max_speed_kmh", "maxspeed", "maxvelocity", "topspeed", "maxspeedkmh"],
  accel: ["accel_count", "accelerations", "accels", "accelcount", "highaccelerations"],
  decel: ["decel_count", "decelerations", "decels", "decelcount", "highdecelerations"],
  load: ["player_load", "playerload", "load", "dynamicstressload"],
  avgHr: ["avg_hr", "averagehr", "avghr", "averageheartrate"],
  maxHr: ["max_hr", "maxhr", "maxheartrate"],
};

/** Reads a per-session summary export: one row per athlete. Distances may be in metres or, with "km" in the header, kilometres. */
export function parseSummary(text: string): SummaryRow[] {
  const { headers, rows } = parseCsv(text);
  const col = Object.fromEntries(Object.entries(COL).map(([k, a]) => [k, findColumn(headers, a)])) as Record<keyof typeof COL, number>;
  if (col.athlete < 0 || col.distance < 0) throw new Error("missing_columns");
  const km = (i: number) => i >= 0 && /km/i.test(headers[i]) && !/kmh|km\/h/i.test(headers[i]);
  const num = (r: string[], i: number) => (i >= 0 ? toNumber(r[i]) : null);
  const dist = (r: string[], i: number) => {
    const n = num(r, i);
    return n == null ? 0 : km(i) ? n * 1000 : n;
  };
  return rows
    .filter((r) => r[col.athlete]?.trim())
    .map((r) => {
      const hsr = dist(r, col.hsr);
      const sprint = dist(r, col.sprintDist);
      return {
        name: r[col.athlete].trim(),
        metrics: {
          minutes: num(r, col.minutes) ?? 0,
          totalDistanceM: Math.round(dist(r, col.distance)),
          hsrDistanceM: Math.round(hsr),
          sprintDistanceM: Math.round(sprint),
          sprintCount: Math.round(num(r, col.sprints) ?? 0),
          maxSpeedKmh: num(r, col.maxSpeed) ?? 0,
          accelCount: Math.round(num(r, col.accel) ?? 0),
          decelCount: Math.round(num(r, col.decel) ?? 0),
          playerLoad: num(r, col.load) ?? 0,
          avgHr: num(r, col.avgHr),
          maxHr: num(r, col.maxHr),
          zones: [],
        },
      };
    });
}
