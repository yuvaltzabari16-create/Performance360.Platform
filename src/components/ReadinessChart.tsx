import { fmtDay, lastDays, readinessTone } from "../lib/dates";
import { useI18n } from "../lib/i18n";

/** Daily readiness bars (0–100) with 50/70 guide lines; gaps show missing check-ins. */
export function ReadinessChart({ values, days = 14 }: { values: Record<string, number>; days?: number }) {
  const { lang, dir } = useI18n();
  const ds = lastDays(days);
  const W = 640, H = 170, padL = 26, padB = 22, padT = 8;
  const iw = W - padL - 6, ih = H - padB - padT;
  const bw = iw / ds.length;
  const y = (v: number) => padT + ih - (v / 100) * ih;
  const color = (v: number) => {
    const tn = readinessTone(v);
    return tn === "good" ? "var(--good)" : tn === "warn" ? "var(--warn)" : "var(--bad)";
  };
  const labelEvery = days > 14 ? 7 : 2;
  // In RTL the newest day sits on the left, matching reading direction.
  const order = dir === "rtl" ? [...ds].reverse() : ds;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Readiness">
      {[50, 70, 100].map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - 6} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray={g === 100 ? undefined : "3 3"} />
          <text x={padL - 4} y={y(g) + 3} textAnchor="end">{g}</text>
        </g>
      ))}
      {order.map((d, i) => {
        const v = values[d];
        const x = padL + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const idx = ds.indexOf(d);
        return (
          <g key={d}>
            {v != null ? (
              <rect x={x} y={y(Math.max(v, 2))} width={w} height={ih + padT - y(Math.max(v, 2))} rx={2} fill={color(v)}>
                <title>{`${fmtDay(d, lang)}: ${v}`}</title>
              </rect>
            ) : (
              <rect x={x} y={padT + ih - 2} width={w} height={2} fill="var(--line)" />
            )}
            {(ds.length - 1 - idx) % labelEvery === 0 && (
              <text x={x + w / 2} y={H - 6} textAnchor="middle">{fmtDay(d, lang, { day: "numeric", month: "numeric" })}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
