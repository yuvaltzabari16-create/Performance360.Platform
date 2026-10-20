import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { getMetric, changeVsPrevious } from '../../base44/shared/metrics.ts';

const key = (m) => (m.metric_key ? m.metric_key + (m.side ? ':' + m.side : '') : 'legacy:' + m.test_name);
const label = (m) => {
  const d = m.metric_key && getMetric(m.metric_key);
  return (d ? d.label : m.test_name) + (m.side ? ` (${m.side})` : '');
};

/** Latest result on or before `date` for one test. */
function valueAtOrBefore(items, date) {
  let best;
  for (const m of items) if (m.date <= date && (!best || m.date >= best.date)) best = m;
  return best;
}

/**
 * Compares the athlete's own results at two dates. Direction comes from the
 * test catalog; legacy free-text tests show the raw difference only.
 */
export default function MetricComparison({ metrics }) {
  const dates = useMemo(() => [...new Set(metrics.map((m) => m.date))].sort(), [metrics]);
  const [dateA, setDateA] = useState('');
  const [dateB, setDateB] = useState('');

  useEffect(() => {
    setDateA(dates[0] || '');
    setDateB(dates[dates.length - 1] || '');
  }, [dates.join('|')]);

  const rows = useMemo(() => {
    if (!dateA || !dateB) return [];
    const groups = new Map();
    for (const m of metrics) {
      if (!groups.has(key(m))) groups.set(key(m), []);
      groups.get(key(m)).push(m);
    }
    return [...groups.values()].map((items) => {
      const a = valueAtOrBefore(items, dateA);
      const b = valueAtOrBefore(items, dateB);
      const def = items[0].metric_key && getMetric(items[0].metric_key);
      const change = def && a && b && a.id !== b.id ? changeVsPrevious(def, b, a) : undefined;
      const raw = a && b && a.id !== b.id && a.unit === b.unit ? b.value - a.value : null;
      return { name: label(items[0]), a, b, change, raw, unit: (b || a)?.unit || '' };
    }).filter((r) => r.a || r.b);
  }, [metrics, dateA, dateB]);

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cmp-a" className="text-xs text-muted-foreground">Baseline date</Label>
            <Input id="cmp-a" type="date" value={dateA} max={dateB || undefined} onChange={(e) => setDateA(e.target.value)} className="w-44" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cmp-b" className="text-xs text-muted-foreground">Comparison date</Label>
            <Input id="cmp-b" type="date" value={dateB} min={dateA || undefined} onChange={(e) => setDateB(e.target.value)} className="w-44" />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">Record results on at least one date to compare.</div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th scope="col" className="text-left font-medium px-4 py-2.5">Test</th>
                  <th scope="col" className="text-right font-medium px-4 py-2.5">At {dateA}</th>
                  <th scope="col" className="text-right font-medium px-4 py-2.5">At {dateB}</th>
                  <th scope="col" className="text-right font-medium px-4 py-2.5">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const improved = r.change ? r.change.delta > 0 : null;
                  return (
                    <tr key={r.name}>
                      <td className="px-4 py-2.5 font-medium">{r.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.a ? `${r.a.value} ${r.a.unit || ''}` : '—'}<span className="block text-[10px] text-muted-foreground">{r.a?.date}</span></td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.b ? `${r.b.value} ${r.b.unit || ''}` : '—'}<span className="block text-[10px] text-muted-foreground">{r.b?.date}</span></td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${improved === true ? 'text-emerald-500' : improved === false && r.change.delta < 0 ? 'text-rose-500' : ''}`}>
                        {r.change ? (
                          <span className="inline-flex items-center gap-1">
                            {r.change.delta > 0 ? <ArrowUpRight className="w-4 h-4" aria-label="improved" /> : r.change.delta < 0 ? <ArrowDownRight className="w-4 h-4" aria-label="declined" /> : <Minus className="w-4 h-4" aria-label="no change" />}
                            {r.change.percent > 0 ? '+' : ''}{r.change.percent}%
                          </span>
                        ) : r.raw !== null ? `${r.raw > 0 ? '+' : ''}${Math.round(r.raw * 100) / 100} ${r.unit}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Each column shows the latest result on or before that date. Green means improved for that test.</p>
      </div>
    </Card>
  );
}
