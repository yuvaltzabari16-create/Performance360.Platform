/** Fixture records the test-mode WHOOP provider returns: the last 10 days, recovery rising, sleep around 7 hours. */
const DAY = 86_400_000;

function isoDaysAgo(n: number, hour: number): string {
  const d = new Date(Date.now() - n * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function mockRecords(kind: "recovery" | "sleep" | "cycle") {
  return Array.from({ length: 10 }, (_, i) => {
    const n = 9 - i;
    if (kind === "recovery") return { cycle_id: i, created_at: isoDaysAgo(n, 6), timezone_offset: "+00:00", score_state: "SCORED", score: { recovery_score: 50 + i * 4, resting_heart_rate: 56 - i * 0.5, hrv_rmssd_milli: 45 + i * 2.5, spo2_percentage: 96, skin_temp_celsius: 33.1 } };
    if (kind === "sleep") return { id: `s-${i}`, start: isoDaysAgo(n + 1, 22), end: isoDaysAgo(n, 5), timezone_offset: "+00:00", nap: false, score_state: "SCORED", score: { stage_summary: { total_light_sleep_time_milli: 3.2 * 3.6e6, total_slow_wave_sleep_time_milli: 1.6 * 3.6e6, total_rem_sleep_time_milli: 2 * 3.6e6 }, sleep_performance_percentage: 70 + i * 2 } };
    return { id: i, start: isoDaysAgo(n, 5), timezone_offset: "+00:00", score_state: "SCORED", score: { strain: 8 + (i % 5) * 2, average_heart_rate: 68, max_heart_rate: 170 } };
  });
}
