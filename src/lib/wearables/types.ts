/** Shared shapes for wearable (WHOOP, Fitbit) data. */

export const WEARABLE_PROVIDERS = ["whoop", "fitbit"] as const;
export type WearableProvider = (typeof WEARABLE_PROVIDERS)[number];
export const isWearableProvider = (v: string | null | undefined): v is WearableProvider => (WEARABLE_PROVIDERS as readonly string[]).includes(v ?? "");

/** One day of metrics. Every metric is optional: providers cover different things. */
export interface DailyMetrics {
  day: string; // YYYY-MM-DD
  recovery_score?: number | null;
  hrv_ms?: number | null;
  resting_hr?: number | null;
  sleep_hours?: number | null;
  sleep_performance?: number | null;
  strain?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  spo2?: number | null;
  skin_temp_c?: number | null;
}

export const METRIC_KEYS = ["recovery_score", "hrv_ms", "resting_hr", "sleep_hours", "sleep_performance", "strain", "avg_hr", "max_hr", "spo2", "skin_temp_c"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/** Stored (encrypted) token set for a provider. */
export interface TokenSet {
  access: string;
  refresh: string | null;
  expiresAt: Date | null;
}

export interface ConnectionRow {
  id: string;
  athlete_id: string;
  provider: WearableProvider;
  source: "api" | "file";
  status: "connected" | "disconnected" | "error";
  share_with_staff: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  connected_at: string;
}

export interface DailyRow extends Required<Pick<DailyMetrics, "day">> {
  athlete_id: string;
  provider: WearableProvider;
  recovery_score: number | null;
  hrv_ms: number | null;
  resting_hr: number | null;
  sleep_hours: number | null;
  sleep_performance: number | null;
  strain: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  spo2: number | null;
  skin_temp_c: number | null;
}
