// Pure calculations on measured data. Measured values stay in the database;
// everything here is derived on read so it can never drift from the source.

import type { ReadinessEntry } from "./types";

/** Best trial: max when higher is better, min otherwise (e.g. sprint times). */
export function bestTrial(trials: number[], higherIsBetter: boolean): number | null {
  const valid = trials.filter((t) => Number.isFinite(t));
  if (valid.length === 0) return null;
  return higherIsBetter ? Math.max(...valid) : Math.min(...valid);
}

export function meanTrial(trials: number[]): number | null {
  const valid = trials.filter((t) => Number.isFinite(t));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Percentage change from a reference value. Returns null when a percentage is
 * not meaningful (missing or zero/negative reference).
 */
export function percentChange(current: number | null, reference: number | null): number | null {
  if (current == null || reference == null || reference <= 0) return null;
  return ((current - reference) / reference) * 100;
}

/** Whether a change is an improvement given the test's direction. */
export function isImprovement(change: number | null, higherIsBetter: boolean): boolean | null {
  if (change == null || change === 0) return null;
  return higherIsBetter ? change > 0 : change < 0;
}

/**
 * Between-limb difference as % of the better side:
 * (stronger - weaker) / stronger * 100. Direction-aware for time-based tests.
 */
export function limbDifference(left: number | null, right: number | null, higherIsBetter: boolean): number | null {
  if (left == null || right == null || left <= 0 || right <= 0) return null;
  const better = higherIsBetter ? Math.max(left, right) : Math.min(left, right);
  const worse = higherIsBetter ? Math.min(left, right) : Math.max(left, right);
  return (Math.abs(better - worse) / (higherIsBetter ? better : worse)) * 100;
}

export interface ResultPoint {
  tested_on: string;
  side: "both" | "left" | "right";
  trials: number[];
  is_baseline: boolean;
  method: string | null;
}

export interface TestSummary {
  latest: number | null;
  latestDate: string | null;
  previous: number | null;
  personalBest: number | null;
  baseline: number | null;
  changeFromBaselinePct: number | null;
  changeFromPreviousPct: number | null;
  methods: string[];
  count: number;
}

/** Summarise one athlete's results for one test and side, sorted by date. */
export function summarizeResults(results: ResultPoint[], higherIsBetter: boolean): TestSummary {
  const sorted = [...results].sort((a, b) => a.tested_on.localeCompare(b.tested_on));
  const bests = sorted.map((r) => bestTrial(r.trials, higherIsBetter));
  const latest = bests.at(-1) ?? null;
  const previous = bests.length > 1 ? bests.at(-2) ?? null : null;
  const valid = bests.filter((b): b is number => b != null);
  const personalBest = valid.length ? (higherIsBetter ? Math.max(...valid) : Math.min(...valid)) : null;
  const baselineIdx = sorted.findIndex((r) => r.is_baseline);
  const baseline = baselineIdx >= 0 ? bests[baselineIdx] : bests[0] ?? null;
  return {
    latest,
    latestDate: sorted.at(-1)?.tested_on ?? null,
    previous,
    personalBest,
    baseline,
    changeFromBaselinePct: sorted.length > 1 ? percentChange(latest, baseline) : null,
    changeFromPreviousPct: percentChange(latest, previous),
    methods: [...new Set(sorted.map((r) => r.method?.trim()).filter((m): m is string => Boolean(m)))],
    count: sorted.length,
  };
}

/** Session load in arbitrary units: session RPE (0-10) x duration (min). */
export function sessionLoad(rpe: number | null, durationMin: number | null): number | null {
  if (rpe == null || durationMin == null) return null;
  return rpe * durationMin;
}

/**
 * Wellness index 1-5 (higher = better) from the 1-5 items. Fatigue, soreness
 * and stress are scored so that 1 = best on the form, then inverted here.
 * Returns null when fewer than 3 items were answered.
 */
export function wellnessIndex(e: Pick<ReadinessEntry, "sleep_quality" | "fatigue" | "soreness" | "stress" | "mood" | "motivation">): number | null {
  const positive = [e.sleep_quality, e.mood, e.motivation];
  const negative = [e.fatigue, e.soreness, e.stress];
  const items = [
    ...positive.filter((v): v is number => v != null),
    ...negative.filter((v): v is number => v != null).map((v) => 6 - v),
  ];
  if (items.length < 3) return null;
  return items.reduce((a, b) => a + b, 0) / items.length;
}

/**
 * Flags an entry for coach review when the wellness index falls clearly below
 * the athlete's own recent average. This is a prompt to look, not a prediction.
 */
export function readinessFlag(current: number | null, history: (number | null)[], threshold = 0.75): boolean {
  const prior = history.filter((v): v is number => v != null);
  if (current == null || prior.length < 3) return false;
  const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
  return avg - current >= threshold;
}

export function ageFromDob(dob: string | null, today = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const m = today.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
  return age;
}
