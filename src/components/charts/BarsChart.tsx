"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BarsChart({ data, dataKey, label, height = 200 }: { data: Record<string, string | number>[]; dataKey: string; label: string; height?: number }) {
  if (data.length === 0) return null;
  return (
    <div dir="ltr" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#e4e8e6" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7672" }} tickLine={false} axisLine={{ stroke: "#e4e8e6" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7672" }} tickLine={false} axisLine={false} width={56} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e8e6", fontSize: 12 }} />
          <Bar dataKey={dataKey} name={label} fill="#23985e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
