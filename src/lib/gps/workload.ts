/**
 * Acute:chronic workload ratio from session load.
 * Acute = load in the last 7 days. Chronic = average weekly load over the last 28 days.
 * A ratio above 1.5 or below 0.8 is flagged for a coach to look at; it is a prompt, not a diagnosis.
 */
export interface LoadEntry {
  athleteId: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  load: number;
}

export type WorkloadStatus = "high" | "ok" | "low" | "unknown";

export interface Workload {
  athleteId: string;
  acute: number;
  chronic: number;
  ratio: number | null;
  status: WorkloadStatus;
}

export const HIGH_RATIO = 1.5;
export const LOW_RATIO = 0.8;
const DAY = 86_400_000;

export function statusOf(ratio: number | null): WorkloadStatus {
  if (ratio === null) return "unknown";
  return ratio > HIGH_RATIO ? "high" : ratio < LOW_RATIO ? "low" : "ok";
}

/** Workload per athlete as of `asOf` (the date of the latest session by default). Sorted riskiest first. */
export function workloads(entries: LoadEntry[], asOf?: string): Workload[] {
  if (!entries.length) return [];
  const end = Date.parse(asOf ?? entries.reduce((a, e) => (e.date > a ? e.date : a), entries[0].date));
  const ageDays = (d: string) => Math.floor((end - Date.parse(d)) / DAY);
  const byAthlete = new Map<string, LoadEntry[]>();
  for (const e of entries) byAthlete.set(e.athleteId, [...(byAthlete.get(e.athleteId) ?? []), e]);

  const out: Workload[] = [];
  for (const [athleteId, list] of byAthlete) {
    const inWindow = (days: number) => list.filter((e) => ageDays(e.date) >= 0 && ageDays(e.date) < days);
    const acute = inWindow(7).reduce((a, e) => a + e.load, 0);
    const month = inWindow(28);
    const chronic = month.reduce((a, e) => a + e.load, 0) / 4;
    // Less than two weeks of history makes the chronic figure meaningless.
    const history = Math.max(...list.map((e) => ageDays(e.date)));
    const ratio = chronic > 0 && history >= 14 ? Math.round((acute / chronic) * 100) / 100 : null;
    out.push({ athleteId, acute: Math.round(acute), chronic: Math.round(chronic), ratio, status: statusOf(ratio) });
  }
  const rank = { high: 0, low: 1, ok: 2, unknown: 3 } as const;
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (b.ratio ?? 0) - (a.ratio ?? 0));
}
