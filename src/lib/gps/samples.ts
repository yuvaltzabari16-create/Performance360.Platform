import { MAX_PLAYERS_PER_FILE } from "./constants";
import { findColumn, parseCsv, toNumber } from "./csv";
import type { PitchSize, Sample } from "./types";

export interface ParsedSamples {
  players: Map<string, Sample[]>;
  warnings: string[];
}

const COL = {
  athlete: ["athlete", "player", "name", "playername", "athletename"],
  time: ["time_s", "time", "t", "seconds", "elapsed", "timestamp", "datetime"],
  x: ["x_m", "x", "posx"],
  y: ["y_m", "y", "posy"],
  lat: ["lat", "latitude"],
  lon: ["lon", "lng", "long", "longitude"],
  speedKmh: ["speed_kmh", "speedkmh", "velocitykmh", "speed"],
  speedMs: ["speed_ms", "speedms", "velocity", "velocityms"],
  hr: ["hr", "heart_rate", "heartrate", "bpm"],
};

/** Seconds from a plain number or an ISO / date-time string. */
function toSeconds(value: string): number | null {
  const n = toNumber(value);
  if (n != null) return n;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms / 1000;
}

/**
 * Reads a per-reading export: one row per athlete per moment. Positions come as pitch metres
 * (x_m, y_m) or as latitude / longitude, which are fitted to the pitch rectangle (approximate).
 */
export function parseSamples(text: string, pitch: PitchSize): ParsedSamples {
  const { headers, rows } = parseCsv(text);
  const warnings: string[] = [];
  const iAth = findColumn(headers, COL.athlete);
  const iTime = findColumn(headers, COL.time);
  const iX = findColumn(headers, COL.x);
  const iY = findColumn(headers, COL.y);
  const iLat = findColumn(headers, COL.lat);
  const iLon = findColumn(headers, COL.lon);
  const iKmh = findColumn(headers, COL.speedKmh);
  const iMs = findColumn(headers, COL.speedMs);
  const iHr = findColumn(headers, COL.hr);
  if (iAth < 0 || iTime < 0) throw new Error("missing_columns");
  const metres = iX >= 0 && iY >= 0;
  if (!metres && !(iLat >= 0 && iLon >= 0)) throw new Error("missing_position");

  type Raw = { name: string; t: number; a: number; b: number; speed: number | null; hr: number | null };
  const raw: Raw[] = [];
  let skipped = 0;
  for (const r of rows) {
    const name = r[iAth]?.trim();
    const t = toSeconds(r[iTime] ?? "");
    const a = toNumber(r[metres ? iX : iLat]);
    const b = toNumber(r[metres ? iY : iLon]);
    if (!name || t == null || a == null || b == null) { skipped++; continue; }
    const kmh = iKmh >= 0 ? toNumber(r[iKmh]) : null;
    const ms = iMs >= 0 ? toNumber(r[iMs]) : null;
    raw.push({ name, t, a, b, speed: kmh != null ? kmh / 3.6 : ms, hr: iHr >= 0 ? toNumber(r[iHr]) : null });
  }
  if (skipped) warnings.push(`skipped_rows:${skipped}`);

  const names = new Set(raw.map((s) => s.name));
  if (names.size > MAX_PLAYERS_PER_FILE) throw new Error("too_many_players");
  const t0 = Math.min(...raw.map((s) => s.t));

  // Lat/lon → metres on a local flat projection, then fitted into the pitch rectangle.
  let project = (a: number, b: number) => ({ x: a, y: b });
  if (!metres && raw.length) {
    const lat0 = raw.reduce((s, p) => s + p.a, 0) / raw.length;
    const mPerLat = 111_320;
    const mPerLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
    const xs = raw.map((p) => p.b * mPerLon);
    const ys = raw.map((p) => p.a * mPerLat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    // The longer side of the track is taken as the pitch length.
    const longIsX = maxX - minX >= maxY - minY;
    const spanL = Math.max(longIsX ? maxX - minX : maxY - minY, 1);
    const spanW = Math.max(longIsX ? maxY - minY : maxX - minX, 1);
    project = (lat, lon) => {
      const x = lon * mPerLon, y = lat * mPerLat;
      const l = longIsX ? x - minX : y - minY;
      const w = longIsX ? y - minY : x - minX;
      return { x: (l / spanL) * pitch.length, y: (w / spanW) * pitch.width };
    };
    warnings.push("positions_fitted");
  }

  const players = new Map<string, Sample[]>();
  for (const s of raw) {
    const p = metres ? { x: s.a, y: s.b } : project(s.a, s.b);
    const list = players.get(s.name) ?? [];
    list.push({ t: s.t - t0, x: p.x, y: p.y, speed: s.speed, hr: s.hr });
    players.set(s.name, list);
  }
  return { players, warnings };
}
