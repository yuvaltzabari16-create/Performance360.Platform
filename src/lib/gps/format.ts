import type { GpsMetrics } from "./types";

/** "10.4 km" above 1 km, otherwise "850 m". */
export function formatDistance(m: number): string {
  return m >= 1000 ? `${(Math.round(m / 100) / 10).toLocaleString("en")} km` : `${Math.round(m)} m`;
}

export const perMinute = (m: number, minutes: number) => (minutes > 0 ? Math.round(m / minutes) : 0);

/** Percent difference of a value from a reference; null when there is no reference. */
export function percentDiff(value: number, reference: number): number | null {
  return reference > 0 ? Math.round(((value - reference) / reference) * 100) : null;
}

export const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Normalised athlete name for matching file rows to roster athletes ("  Amy   Cole " = "amy cole"). */
export const nameKey = (name: string) => name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Database row for the import function. */
export function toRpcRow(athleteId: string, m: GpsMetrics, heat: { cols: number; rows: number; cells: number[] } | null) {
  return {
    athlete_id: athleteId,
    minutes: m.minutes,
    total_distance_m: m.totalDistanceM,
    hsr_distance_m: m.hsrDistanceM,
    sprint_distance_m: m.sprintDistanceM,
    sprint_count: m.sprintCount,
    max_speed_kmh: m.maxSpeedKmh,
    accel_count: m.accelCount,
    decel_count: m.decelCount,
    player_load: m.playerLoad,
    avg_hr: m.avgHr,
    max_hr: m.maxHr,
    zones: m.zones,
    heat,
  };
}

/** Row as stored in the database. */
export interface GpsMetricRow {
  id: string;
  session_id: string;
  athlete_id: string;
  minutes: number;
  total_distance_m: number;
  hsr_distance_m: number;
  sprint_distance_m: number;
  sprint_count: number;
  max_speed_kmh: number;
  accel_count: number;
  decel_count: number;
  player_load: number;
  avg_hr: number | null;
  max_hr: number | null;
  zones: number[];
  heat: { cols: number; rows: number; cells: number[] } | null;
}

export interface GpsSessionRow {
  id: string;
  title: string;
  kind: "training" | "match";
  session_date: string;
  duration_min: number | null;
  pitch_length_m: number;
  pitch_width_m: number;
  source: string;
  is_sample: boolean;
  owner_id: string | null;
}
