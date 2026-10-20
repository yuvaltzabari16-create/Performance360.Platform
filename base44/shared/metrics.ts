// Performance-test catalog: units, direction and plausibility bounds.
//
// Bounds are input sanity checks to catch typos (e.g. 18 s for a 10 m
// sprint). They are NOT normative or reference values and must never be
// shown to users as benchmarks. Derived metrics are computed only from a
// documented formula and only when every input is present.

import { ValidationError, optionalNumber, optionalText, requireDate, requireNotFuture, utcToday } from './validation.ts';

export type MetricCategory =
  | 'speed' | 'power' | 'strength' | 'change_of_direction'
  | 'endurance' | 'repeated_sprint' | 'mobility';

export interface MetricDef {
  key: string;
  label: string;
  category: MetricCategory;
  unit: string;
  min: number;
  max: number;
  /** 'lower' when a smaller value is a better result (e.g. sprint time). */
  better: 'higher' | 'lower';
  sided?: boolean;
  protocol: string;
}

export const METRICS: MetricDef[] = [
  { key: 'sprint_5m', label: '5 m sprint', category: 'speed', unit: 's', min: 0.6, max: 3, better: 'lower', protocol: 'Timing gates, standing start 0.5 m behind the first gate. Record best of trials.' },
  { key: 'sprint_10m', label: '10 m sprint', category: 'speed', unit: 's', min: 1.2, max: 4, better: 'lower', protocol: 'Timing gates, standing start 0.5 m behind the first gate. Record best of trials.' },
  { key: 'sprint_20m', label: '20 m sprint', category: 'speed', unit: 's', min: 2.2, max: 6, better: 'lower', protocol: 'Timing gates, standing start 0.5 m behind the first gate. Record best of trials.' },
  { key: 'sprint_30m', label: '30 m sprint', category: 'speed', unit: 's', min: 3, max: 8, better: 'lower', protocol: 'Timing gates, standing start 0.5 m behind the first gate. Record best of trials.' },
  { key: 'cmj_height', label: 'Countermovement jump', category: 'power', unit: 'cm', min: 5, max: 100, better: 'higher', protocol: 'Hands on hips, self-selected depth. Record device and method (flight time or impulse-momentum).' },
  { key: 'sj_height', label: 'Squat jump', category: 'power', unit: 'cm', min: 5, max: 100, better: 'higher', protocol: 'Hands on hips, ~90° knee angle held 2–3 s, no countermovement.' },
  { key: 'dj_height', label: 'Drop jump height', category: 'power', unit: 'cm', min: 5, max: 100, better: 'higher', protocol: 'Record the drop height used in the notes.' },
  { key: 'dj_contact_time', label: 'Drop jump contact time', category: 'power', unit: 'ms', min: 80, max: 800, better: 'lower', protocol: 'Ground contact time from the same trial as drop jump height.' },
  { key: 'sl_cmj_height', label: 'Single-leg CMJ', category: 'power', unit: 'cm', min: 2, max: 60, better: 'higher', sided: true, protocol: 'Hands on hips, test each leg. Record side.' },
  { key: 'back_squat_1rm', label: 'Back squat 1RM', category: 'strength', unit: 'kg', min: 10, max: 400, better: 'higher', protocol: 'Directly tested 1RM. Record depth standard in notes. Do not enter estimated values here.' },
  { key: 'trap_bar_deadlift_1rm', label: 'Trap-bar deadlift 1RM', category: 'strength', unit: 'kg', min: 10, max: 450, better: 'higher', protocol: 'Directly tested 1RM, high or low handles noted.' },
  { key: 'bench_press_1rm', label: 'Bench press 1RM', category: 'strength', unit: 'kg', min: 10, max: 300, better: 'higher', protocol: 'Directly tested 1RM, touch-and-go or paused noted.' },
  { key: 'imtp_peak_force', label: 'Isometric mid-thigh pull', category: 'strength', unit: 'N', min: 300, max: 8000, better: 'higher', protocol: 'Peak force on force plates, best of trials.' },
  { key: 'cod_505', label: '505 change of direction', category: 'change_of_direction', unit: 's', min: 1.6, max: 4.5, better: 'lower', sided: true, protocol: '10 m run-in, time 5 m to the line and 5 m back. Record turning side.' },
  { key: 'pro_agility', label: 'Pro-agility (5-10-5)', category: 'change_of_direction', unit: 's', min: 3.5, max: 8, better: 'lower', protocol: 'Standard 5-10-5 shuttle with timing gates or stopwatch (record which).' },
  { key: 'yoyo_ir1', label: 'Yo-Yo IR1 distance', category: 'endurance', unit: 'm', min: 40, max: 4000, better: 'higher', protocol: 'Total distance covered at the final completed shuttle.' },
  { key: 'ift_30_15', label: '30-15 IFT final velocity', category: 'endurance', unit: 'km/h', min: 8, max: 30, better: 'higher', protocol: 'Velocity of the last completed stage.' },
  { key: 'rsa_best', label: 'Repeated sprint — best', category: 'repeated_sprint', unit: 's', min: 2, max: 15, better: 'lower', protocol: 'Fastest sprint of the series. Record sprint distance, count and recovery in notes.' },
  { key: 'rsa_mean', label: 'Repeated sprint — mean', category: 'repeated_sprint', unit: 's', min: 2, max: 15, better: 'lower', protocol: 'Mean time of all sprints in the same series as rsa_best.' },
  { key: 'knee_to_wall', label: 'Knee-to-wall', category: 'mobility', unit: 'cm', min: 0, max: 25, better: 'higher', sided: true, protocol: 'Weight-bearing lunge, distance from toe to wall with knee touching.' },
  { key: 'sit_and_reach', label: 'Sit and reach', category: 'mobility', unit: 'cm', min: -40, max: 60, better: 'higher', protocol: 'Standard box; record whether 0 is at the feet or the box edge.' },
];

const BY_KEY = new Map(METRICS.map((m) => [m.key, m]));
export const getMetric = (key: string) => BY_KEY.get(key);

export const SIDES = ['left', 'right', 'bilateral'] as const;

export interface MetricInput {
  metric_key: unknown;
  value: unknown;
  date: unknown;
  side?: unknown;
  notes?: unknown;
}

export interface MetricRecord {
  metric_key: string;
  test_name: string;
  category: MetricCategory;
  unit: string;
  value: number;
  date: string;
  side?: string;
  notes?: string;
}

/** Validates a test result against the catalog. Throws ValidationError. */
export function validateMetric(input: MetricInput, today: string = utcToday()): MetricRecord {
  const def = typeof input.metric_key === 'string' ? getMetric(input.metric_key) : undefined;
  if (!def) throw new ValidationError('Unknown test. Choose a test from the catalog.');
  const value = optionalNumber(input.value, def.label, def.min, def.max);
  if (value === undefined) throw new ValidationError(`${def.label} value is required`);
  const date = requireNotFuture(requireDate(input.date, 'Test date'), today, 'Test date');
  let side: string | undefined;
  if (def.sided) {
    if (typeof input.side !== 'string' || !(SIDES as readonly string[]).includes(input.side) || input.side === 'bilateral') {
      throw new ValidationError(`${def.label} needs a side (left or right)`);
    }
    side = input.side;
  }
  return {
    metric_key: def.key,
    test_name: def.label,
    category: def.category,
    unit: def.unit,
    value,
    date,
    side,
    notes: optionalText(input.notes, 'Notes', 1000),
  };
}

/**
 * Reactive strength index (drop jump) = jump height (m) / contact time (s).
 * Only computed when both values come from the same trial.
 */
export function reactiveStrengthIndex(jumpHeightCm?: number, contactMs?: number): number | undefined {
  if (!jumpHeightCm || !contactMs || jumpHeightCm <= 0 || contactMs <= 0) return undefined;
  return Math.round(((jumpHeightCm / 100) / (contactMs / 1000)) * 100) / 100;
}

/**
 * Repeated-sprint percentage decrement = (mean / best − 1) × 100, which is
 * equivalent to (sum of times / (best × n) − 1) × 100.
 */
export function rsaDecrement(best?: number, mean?: number): number | undefined {
  if (!best || !mean || best <= 0 || mean < best) return undefined;
  return Math.round((mean / best - 1) * 1000) / 10;
}

/**
 * Change versus the athlete's own previous result for the same test and
 * side, signed so that a positive number always means "improved".
 * Returns undefined when units differ or no previous result exists.
 */
export function changeVsPrevious(
  def: Pick<MetricDef, 'better' | 'unit'>,
  current: { value: number; unit?: string },
  previous?: { value: number; unit?: string },
): { delta: number; percent: number } | undefined {
  if (!previous || !Number.isFinite(previous.value) || previous.value === 0) return undefined;
  if ((current.unit && current.unit !== def.unit) || (previous.unit && previous.unit !== def.unit)) return undefined;
  const raw = current.value - previous.value;
  const signed = def.better === 'lower' ? -raw : raw;
  return {
    delta: Math.round(signed * 1000) / 1000,
    percent: Math.round((signed / Math.abs(previous.value)) * 1000) / 10,
  };
}

/** Readiness / wellness self-report. Scales are documented in the UI. */
export function validateReadiness(input: Record<string, unknown>, today: string = utcToday()) {
  const date = requireNotFuture(requireDate(input.date, 'Date'), today, 'Date');
  const out = {
    date,
    sleep_hours: optionalNumber(input.sleep_hours, 'Sleep hours', 0, 24),
    soreness: optionalNumber(input.soreness, 'Soreness (1–10)', 1, 10),
    mood: optionalNumber(input.mood, 'Mood (1–10)', 1, 10),
    rpe: optionalNumber(input.rpe, 'Yesterday session RPE (0–10)', 0, 10),
    notes: optionalText(input.notes, 'Notes', 1000),
  };
  if (out.sleep_hours === undefined && out.soreness === undefined && out.mood === undefined && out.rpe === undefined) {
    throw new ValidationError('Enter at least one wellness value');
  }
  return out;
}
