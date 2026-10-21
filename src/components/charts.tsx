import { fmtDay, lastDays } from "../lib/dates";
import { useI18n } from "../lib/i18n";

/** One bar per calendar day for the last `days` days; missing days show a thin baseline. */
export function DayBars({ values, days, max, guides = [], color, label, fmt = (v) => String(Math.round(v)) }: {
  values: Record<string, number>; days: number; max?: number; guides?: number[];
  color: (v: number) => string; label: string; fmt?: (v: number) => string;
}) {
  const { lang, dir } = useI18n();
  const ds = lastDays(days);
  const top = max ?? Math.max(10, ...ds.map((d) => values[d] ?? 0)) * 1.1;
  const W = 640, H = 170, padL = 34, padB = 22, padT = 8;
  const iw = W - padL - 6, ih = H - padB - padT;
  const bw = iw / ds.length;
  const y = (v: number) => padT + ih - (v / top) * ih;
  const order = dir === "rtl" ? [...ds].reverse() : ds;
  const labelEvery = days > 14 ? 7 : 2;
  const gridLines = guides.length ? guides : [top / 2, top].map((v) => Math.round(v / 10) * 10);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {gridLines.map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - 6} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray="3 3" />
          <text x={padL - 4} y={y(g) + 3} textAnchor="end">{g}</text>
        </g>
      ))}
      <line x1={padL} x2={W - 6} y1={padT + ih} y2={padT + ih} stroke="var(--line)" />
      {order.map((d, i) => {
        const v = values[d];
        const x = padL + i * bw + bw * 0.18, w = bw * 0.64;
        const idx = ds.indexOf(d);
        const h = v != null ? Math.max(2, padT + ih - y(v)) : 0;
        return (
          <g key={d}>
            {v != null ? <rect x={x} y={padT + ih - h} width={w} height={h} rx={2} fill={color(v)}><title>{`${fmtDay(d, lang)}: ${fmt(v)}`}</title></rect> : null}
            {(ds.length - 1 - idx) % labelEvery === 0 && (
              <text x={x + w / 2} y={H - 6} textAnchor="middle">{fmtDay(d, lang, { day: "numeric", month: "numeric" })}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Simple line chart over dated points (e.g. team average per test day). */
export function DateLine({ points, label, fmt = (v) => v.toFixed(1) }: {
  points: { date: string; value: number }[]; label: string; fmt?: (v: number) => string;
}) {
  const { lang, dir } = useI18n();
  if (points.length === 0) return null;
  const W = 640, H = 170, padL = 44, padR = 16, padB = 22, padT = 14;
  const iw = W - padL - padR, ih = H - padB - padT;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
  const t0 = new Date(points[0].date).getTime(), t1 = new Date(points[points.length - 1].date).getTime();
  const span = Math.max(1, t1 - t0);
  const xr = (d: string) => padL + (points.length === 1 ? iw / 2 : ((new Date(d).getTime() - t0) / span) * iw);
  const x = (d: string) => (dir === "rtl" ? W - xr(d) + padL - padR : xr(d));
  const y = (v: number) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8].map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray="3 3" />
          <text x={padL - 4} y={y(g) + 3} textAnchor="end">{fmt(g)}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {points.map((p) => (
        <g key={p.date}>
          <circle cx={x(p.date)} cy={y(p.value)} r={3.5} fill="var(--accent)"><title>{`${fmtDay(p.date, lang)}: ${fmt(p.value)}`}</title></circle>
          <text x={x(p.date)} y={H - 6} textAnchor="middle">{fmtDay(p.date, lang, { day: "numeric", month: "numeric" })}</text>
        </g>
      ))}
    </svg>
  );
}
