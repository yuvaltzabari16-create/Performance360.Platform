import { workloads, type LoadEntry, type WorkloadStatus } from "@/lib/gps/workload";

/** Recovery below this is worth a conversation (kept for imports of recovery data; no source feeds it now). */
export const LOW_RECOVERY = 34;

export interface DailyRow {
  athleteId: string;
  /** ISO date, YYYY-MM-DD. */
  day: string;
  recovery: number | null;
}

export type AlertKind = "workload_high" | "workload_low" | "recovery_low";

export interface StaffAlert {
  athleteId: string;
  kind: AlertKind;
  /** The figure behind the alert: the ratio or the recovery percent. */
  value: number;
}

const kindOf: Partial<Record<WorkloadStatus, AlertKind>> = { high: "workload_high", low: "workload_low" };

/**
 * Alerts for the coaching staff, most urgent first: high workload ratio, then low recovery, then low workload.
 * Recovery counts only when the latest reading is from the last two days (an old reading is not today's state).
 */
export function staffAlerts(load: LoadEntry[], daily: DailyRow[], today: string): StaffAlert[] {
  const out: StaffAlert[] = [];
  for (const w of workloads(load, today)) {
    const kind = kindOf[w.status];
    if (kind && w.ratio !== null) out.push({ athleteId: w.athleteId, kind, value: w.ratio });
  }
  const latest = new Map<string, DailyRow>();
  for (const r of daily) {
    if (r.recovery === null) continue;
    const cur = latest.get(r.athleteId);
    if (!cur || r.day > cur.day) latest.set(r.athleteId, r);
  }
  const cutoff = new Date(Date.parse(today) - 2 * 86_400_000).toISOString().slice(0, 10);
  for (const r of latest.values()) {
    if (r.day >= cutoff && r.recovery! < LOW_RECOVERY) out.push({ athleteId: r.athleteId, kind: "recovery_low", value: Math.round(r.recovery!) });
  }
  const rank: Record<AlertKind, number> = { workload_high: 0, recovery_low: 1, workload_low: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
