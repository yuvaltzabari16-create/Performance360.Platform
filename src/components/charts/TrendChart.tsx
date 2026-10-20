"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

/** Line chart for values over dates. Missing values leave gaps rather than inventing points. */
export function TrendChart({ data, series, unit, height = 220, reversed = false }: {
  data: Record<string, string | number | null>[];
  series: TrendSeries[];
  unit?: string;
  height?: number;
  reversed?: boolean;
}) {
  if (data.length === 0) return null;
  return (
    <div dir="ltr" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#e4e8e6" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7672" }} tickLine={false} axisLine={{ stroke: "#e4e8e6" }} />
          <YAxis reversed={reversed} tick={{ fontSize: 11, fill: "#6b7672" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit={unit ? ` ${unit}` : undefined} width={64} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e8e6", fontSize: 12 }} formatter={(v) => (typeof v === "number" ? `${Math.round(v * 100) / 100}${unit ? ` ${unit}` : ""}` : v)} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
