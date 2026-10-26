/** Thresholds and grid size used everywhere GPS data is processed. Change them here only. */

/** Speed zone upper bounds in km/h: standing/walking, jogging, running, high-speed running, sprint. */
export const ZONE_LIMITS_KMH = [7, 14, 19.8, 25.2] as const;
export const ZONE_COUNT = ZONE_LIMITS_KMH.length + 1;
export const HSR_KMH = ZONE_LIMITS_KMH[2];
export const SPRINT_KMH = ZONE_LIMITS_KMH[3];

/** A sprint is a continuous run above the sprint speed for at least this many seconds. */
export const SPRINT_MIN_SECONDS = 1;
/** Accelerations and decelerations: magnitude above this (m/s²) for at least the minimum time. */
export const ACCEL_THRESHOLD = 3;
export const ACCEL_MIN_SECONDS = 0.5;

/** Readings further apart than this are treated as a signal gap, not as movement. */
export const MAX_GAP_SECONDS = 5;
/** No athlete runs faster than this; readings above it are GPS glitches. */
export const MAX_PLAUSIBLE_KMH = 45;

export const HEAT_COLS = 24;
export const HEAT_ROWS = 16;

export const MAX_CSV_BYTES = 8 * 1024 * 1024;
export const MAX_PLAYERS_PER_FILE = 60;
