import type { Dictionary } from "@/lib/i18n";

/**
 * Football pitch with a heat map: each cell's opacity follows the time spent there.
 * Drawn in SVG (no client code); the pitch always reads left to right, also in right-to-left languages.
 */
export function PitchHeatMap({ heat, length, width, t }: { heat: { cols: number; rows: number; cells: number[] } | null; length: number; width: number; t: Dictionary }) {
  if (!heat || heat.cells.length !== heat.cols * heat.rows) return <p className="text-sm text-muted">{t.gps.heatEmpty}</p>;
  const max = Math.max(...heat.cells, 1);
  const cw = length / heat.cols;
  const ch = width / heat.rows;
  const line = { fill: "none", stroke: "#ffffff", strokeWidth: 0.35, strokeOpacity: 0.85 } as const;
  return (
    <div dir="ltr"><svg viewBox={`0 0 ${length} ${width}`} role="img" aria-label={t.gps.heatTitle} className="w-full rounded-lg" data-testid="pitch-heat-map">
      <rect width={length} height={width} fill="#2f7d4f" />
      {heat.cells.map((v, i) => {
        if (v <= 0) return null;
        const c = i % heat.cols;
        const r = Math.floor(i / heat.cols);
        // Square root keeps lightly visited areas visible next to hot spots.
        return <rect key={i} x={c * cw} y={r * ch} width={cw} height={ch} fill="#ff4d2e" fillOpacity={Math.min(0.9, Math.sqrt(v / max) * 0.9)} />;
      })}
      <rect x={0.2} y={0.2} width={length - 0.4} height={width - 0.4} {...line} />
      <line x1={length / 2} y1={0} x2={length / 2} y2={width} {...line} />
      <circle cx={length / 2} cy={width / 2} r={9.15} {...line} />
      <rect x={0.2} y={width / 2 - 20.15} width={16.5} height={40.3} {...line} />
      <rect x={length - 16.7} y={width / 2 - 20.15} width={16.5} height={40.3} {...line} />
      <rect x={0.2} y={width / 2 - 9.16} width={5.5} height={18.32} {...line} />
      <rect x={length - 5.7} y={width / 2 - 9.16} width={5.5} height={18.32} {...line} />
    </svg></div>
  );
}
