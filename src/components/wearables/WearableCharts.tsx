import { TrendChart } from "@/components/charts/TrendChart";
import type { Dictionary } from "@/lib/i18n";
import type { DailyRow } from "@/lib/wearables/types";

/** Two compact charts for a person's recent days: recovery with HRV, and sleep with strain. */
export function WearableCharts({ rows, t }: { rows: DailyRow[]; t: Dictionary }) {
  const tw = t.wearables;
  const ordered = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const data = ordered.map((r) => ({ date: r.day.slice(5), recovery: r.recovery_score, hrv: r.hrv_ms, sleep: r.sleep_hours, strain: r.strain }));
  const has = (k: "recovery" | "hrv" | "sleep" | "strain") => data.some((d) => d[k] != null);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(has("recovery") || has("hrv")) && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{tw.chartRecovery}</h4>
          <TrendChart data={data} height={190} series={[{ key: "recovery", label: `${tw.metrics.recovery} (%)`, color: "#23985e" }, { key: "hrv", label: `${tw.metrics.hrv} (${tw.units.ms})`, color: "#2563eb" }]} />
        </div>
      )}
      {(has("sleep") || has("strain")) && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{tw.chartSleep}</h4>
          <TrendChart data={data} height={190} series={[{ key: "sleep", label: `${tw.metrics.sleep} (${tw.units.hours})`, color: "#7c3aed" }, { key: "strain", label: tw.metrics.strain, color: "#d97706" }]} />
        </div>
      )}
    </div>
  );
}
