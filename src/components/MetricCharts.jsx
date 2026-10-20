import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

const axis = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };
const tooltip = { borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12, background: 'hsl(var(--card))' };

export function TrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={axis} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={axis} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={tooltip} />
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RadarCard({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="category" tick={axis} stroke="hsl(var(--muted-foreground))" />
        <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
        <Tooltip contentStyle={tooltip} />
      </RadarChart>
    </ResponsiveContainer>
  );
}