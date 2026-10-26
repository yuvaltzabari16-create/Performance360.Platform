import type { Dictionary } from "@/lib/i18n";
import { formatDistance } from "@/lib/gps/format";

const COLORS = ["#cfd8d3", "#9ccfb2", "#4fae7b", "#e8a23a", "#d9482b"];

/** Distance split across the five speed zones as one stacked bar with a legend. */
export function ZoneBar({ zones, t }: { zones: number[]; t: Dictionary }) {
  const total = zones.reduce((a, b) => a + b, 0);
  if (zones.length === 0 || total <= 0) return null;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={t.gps.zonesTitle}>
        {zones.map((z, i) => <div key={i} style={{ width: `${(z / total) * 100}%`, background: COLORS[i] }} />)}
      </div>
      <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
        {zones.map((z, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: COLORS[i] }} />{t.gps.zones[i]} <span className="text-muted">{t.gps.zoneRanges[i]}</span></span>
            <span className="num font-medium">{formatDistance(z)} · {Math.round((z / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
