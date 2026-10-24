/** Shared shapes for GPS / wearable data. Distances in metres, speeds in km/h unless a name says otherwise. */

/** One reading from a wearable: seconds from session start, pitch position in metres, speed in m/s. */
export interface Sample {
  t: number;
  x: number;
  y: number;
  /** Metres per second; null when the file has no speed and it must be derived from positions. */
  speed: number | null;
  hr: number | null;
}

export interface PitchSize {
  length: number;
  width: number;
}

export const DEFAULT_PITCH: PitchSize = { length: 105, width: 68 };

/** Everything the app shows about one athlete in one session. */
export interface GpsMetrics {
  minutes: number;
  totalDistanceM: number;
  hsrDistanceM: number;
  sprintDistanceM: number;
  sprintCount: number;
  maxSpeedKmh: number;
  accelCount: number;
  decelCount: number;
  /** App-computed load: sum of speed changes. Not a vendor's proprietary Player Load. */
  playerLoad: number;
  avgHr: number | null;
  maxHr: number | null;
  /** Distance in each of the five speed zones, metres. */
  zones: number[];
}

/** Heat map as a flat row-major grid of time spent per cell. */
export interface HeatGrid {
  cols: number;
  rows: number;
  cells: number[];
}
