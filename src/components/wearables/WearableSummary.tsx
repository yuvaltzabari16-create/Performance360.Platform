import type { Dictionary } from "@/lib/i18n";
import type { DailyRow } from "@/lib/wearables/types";

const fmt = (v: number | null, digits = 0) => (v == null ? "—" : String(Math.round(v * 10 ** digits) / 10 ** digits));

/** The most recent day with data, as small labelled figures. */
export function WearableSummary({ latest, t }: { latest: DailyRow | undefined; t: Dictionary }) {
  if (!latest) return null;
  const tw = t.wearables;
  const items: [string, string][] = [
    [tw.metrics.recovery, `${fmt(latest.recovery_score)} ${tw.units.percent}`],
    [tw.metrics.hrv, `${fmt(latest.hrv_ms, 1)} ${tw.units.ms}`],
    [tw.metrics.rhr, `${fmt(latest.resting_hr)} ${tw.units.bpm}`],
    [tw.metrics.sleep, `${fmt(latest.sleep_hours, 1)} ${tw.units.hours}`],
    [tw.metrics.strain, fmt(latest.strain, 1)],
  ];
  return (
    <div>
      <p className="mb-2 text-xs text-muted">{tw.latest}: <span className="num">{latest.day}</span></p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-canvas p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="num mt-0.5 text-lg font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
