import { findColumn, parseCsv, toNumber } from "@/lib/gps/csv";
import { METRIC_KEYS, type DailyMetrics, type MetricKey, type WearableProvider } from "./types";

/**
 * Importing a device export instead of (or before) a live connection. Supported:
 *   WHOOP   physiological_cycles.csv from the WHOOP data export
 *   Fitbit  sleep-*.json, resting_heart_rate-*.json and the daily HRV summary CSV from the Fitbit / Google export
 *   Any     a plain CSV with a "date" column and any of: recovery_score, hrv_ms, resting_hr, sleep_hours,
 *           sleep_performance, strain, avg_hr, max_hr, spo2, skin_temp_c
 * Several files can be imported together; rows for the same day are merged.
 */

export interface ImportFile { name: string; text: string }
export interface ImportResult { rows: DailyMetrics[]; recognized: string[]; ignored: string[] }

const MAX_DAYS = 400;

const COLS: Record<MetricKey, string[]> = {
  recovery_score: ["recovery_score", "recoveryscore", "recovery score %", "recovery"],
  hrv_ms: ["hrv_ms", "heart rate variability (ms)", "hrv", "rmssd"],
  resting_hr: ["resting_hr", "resting heart rate (bpm)", "restinghr", "rhr", "resting heart rate"],
  sleep_hours: ["sleep_hours", "sleephours", "hours of sleep"],
  sleep_performance: ["sleep_performance", "sleep performance %", "sleepperformance", "sleep efficiency", "efficiency"],
  strain: ["strain", "day strain"],
  avg_hr: ["avg_hr", "average hr (bpm)", "averagehr"],
  max_hr: ["max_hr", "max hr (bpm)", "maxhr"],
  spo2: ["spo2", "blood oxygen %", "oxygen"],
  skin_temp_c: ["skin_temp_c", "skin temp (celsius)", "skintemp"],
};
const DAY_COLS = ["date", "day", "cycle start time", "timestamp", "datetime"];

const isoDay = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const us = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // Fitbit export: 10/20/25 00:00:00
  if (us) return `${us[3].length === 2 ? `20${us[3]}` : us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
};

/** CSV with a date column and recognised metric columns (covers WHOOP's export and the generic template). */
function fromCsv(text: string): DailyMetrics[] {
  const { headers, rows } = parseCsv(text);
  const dayCol = findColumn(headers, DAY_COLS);
  if (dayCol < 0) return [];
  const cols = METRIC_KEYS.map((k) => [k, findColumn(headers, COLS[k])] as const).filter(([, i]) => i >= 0);
  const hrvDaily = findColumn(headers, ["rmssd"]) >= 0 && findColumn(headers, ["timestamp"]) >= 0; // Fitbit daily HRV summary
  const out: DailyMetrics[] = [];
  for (const r of rows) {
    const day = isoDay(r[dayCol]);
    if (!day) continue;
    const row: DailyMetrics = { day };
    for (const [key, i] of cols) {
      let v = toNumber(r[i]);
      if (v == null) continue;
      if (key === "sleep_hours" && /min/i.test(headers[i])) v /= 60;
      row[key] = Math.round(v * 100) / 100;
    }
    // WHOOP gives sleep as minutes asleep.
    const asleepMin = findColumn(headers, ["asleep duration (min)"]);
    if (asleepMin >= 0 && row.sleep_hours == null) {
      const m = toNumber(r[asleepMin]);
      if (m != null) row.sleep_hours = Math.round((m / 60) * 100) / 100;
    }
    if (hrvDaily && row.hrv_ms == null) continue;
    out.push(row);
  }
  return out;
}

type Json = Record<string, unknown>;

/** Fitbit export JSON: sleep-*.json (dateOfSleep) and resting_heart_rate-*.json (dateTime + value). */
function fromFitbitJson(data: unknown): DailyMetrics[] {
  if (!Array.isArray(data)) return [];
  const byDay = new Map<string, DailyMetrics>();
  const row = (day: string) => byDay.get(day) ?? (byDay.set(day, { day }), byDay.get(day)!);
  for (const item of data as Json[]) {
    if (typeof item.dateOfSleep === "string") {
      if (item.isMainSleep === false) continue;
      const day = isoDay(item.dateOfSleep);
      if (!day) continue;
      const r = row(day);
      if (typeof item.minutesAsleep === "number") r.sleep_hours = Math.round((item.minutesAsleep / 60) * 100) / 100;
      if (typeof item.efficiency === "number") r.sleep_performance = item.efficiency;
    } else if (item.value && typeof item.value === "object") {
      const v = item.value as Json;
      const day = isoDay(typeof v.date === "string" ? v.date : typeof item.dateTime === "string" ? item.dateTime : null);
      if (day && typeof v.value === "number" && v.value > 0) row(day).resting_hr = Math.round(v.value * 10) / 10;
    }
  }
  return [...byDay.values()];
}

function mergeDays(all: DailyMetrics[]): DailyMetrics[] {
  const days = new Map<string, DailyMetrics>();
  for (const r of all) {
    const cur = days.get(r.day) ?? { day: r.day };
    for (const k of METRIC_KEYS) if (r[k] != null) cur[k] = r[k];
    days.set(r.day, cur);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Reads one or more export files; unknown files are listed, never guessed at. */
export function parseWearableFiles(files: ImportFile[], provider: WearableProvider): ImportResult {
  const all: DailyMetrics[] = [];
  const recognized: string[] = [];
  const ignored: string[] = [];
  for (const f of files) {
    const text = f.text.replace(/^﻿/, "").trim();
    let rows: DailyMetrics[] = [];
    if (text.startsWith("[") || text.startsWith("{")) {
      try { rows = provider === "fitbit" ? fromFitbitJson(JSON.parse(text)) : []; } catch { rows = []; }
    } else rows = fromCsv(text);
    if (rows.length) { all.push(...rows); recognized.push(f.name); } else ignored.push(f.name);
  }
  const rows = mergeDays(all).slice(-MAX_DAYS);
  return { rows, recognized, ignored };
}
