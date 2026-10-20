import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

function valueAtOrBefore(metrics, date) {
  const onOrBefore = metrics.filter((m) => m.date <= date).sort((a, b) => a.date.localeCompare(b.date));
  return onOrBefore[onOrBefore.length - 1];
}

export default function MetricComparison({ athleteId }) {
  const [metrics, setMetrics] = useState([]);
  const [dateA, setDateA] = useState('');
  const [dateB, setDateB] = useState('');

  useEffect(() => {
    if (!athleteId) { setMetrics([]); return; }
    base44.entities.PerformanceMetric.filter({ user_id: athleteId }, { sort: '-date', limit: 200 })
      .then((res) => {
        const items = (res.items || []).sort((a, b) => a.date.localeCompare(b.date));
        setMetrics(items);
        const dates = [...new Set(items.map((m) => m.date))].sort();
        if (dates.length >= 2) { setDateA(dates[0]); setDateB(dates[dates.length - 1]); }
        else if (dates.length === 1) { setDateA(dates[0]); setDateB(dates[0]); }
      });
  }, [athleteId]);

  const tests = useMemo(() => [...new Set(metrics.map((m) => m.test_name))], [metrics]);

  const rows = useMemo(() => {
    if (!dateA || !dateB) return [];
    return tests.map((test) => {
      const testMetrics = metrics.filter((m) => m.test_name === test);
      const a = valueAtOrBefore(testMetrics, dateA);
      const b = valueAtOrBefore(testMetrics, dateB);
      const delta = a && b ? b.value - a.value : null;
      const higherIsBetter = !/time|sec|split/i.test(test);
      const trend = delta === null || delta === 0 ? 'flat'
        : (higherIsBetter ? (delta > 0 ? 'up' : 'down') : (delta < 0 ? 'up' : 'down'));
      return { test, a, b, delta, trend, unit: a?.unit || b?.unit || '' };
    }).filter((r) => r.a || r.b);
  }, [metrics, tests, dateA, dateB]);

  const swap = () => { setDateA(dateB); setDateB(dateA); };

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Baseline date</Label>
            <Input type="date" value={dateA} max={dateB || undefined} onChange={(e) => setDateA(e.target.value)} className="w-44" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Comparison date</Label>
            <Input type="date" value={dateB} min={dateA || undefined} onChange={(e) => setDateB(e.target.value)} className="w-44" />
          </div>
          <button onClick={swap} className="text-xs text-primary hover:underline mb-2">Swap dates</button>
        </div>

        {rows.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            Select two dates with recorded metrics to compare.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Test</th>
                  <th className="text-right font-medium px-4 py-2.5">{dateA}</th>
                  <th className="text-right font-medium px-4 py-2.5">{dateB}</th>
                  <th className="text-right font-medium px-4 py-2.5">Δ</th>
                  <th className="text-center font-medium px-4 py-2.5">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.test}>
                    <td className="px-4 py-2.5 font-medium">{r.test}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.a ? `${r.a.value} ${r.a.unit || ''}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.b ? `${r.b.value} ${r.b.unit || ''}` : '—'}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${r.delta === null ? '' : r.delta > 0 ? 'text-emerald-600' : r.delta < 0 ? 'text-rose-600' : ''}`}>
                      {r.delta === null ? '—' : `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(2).replace(/\.00$/, '')} ${r.unit}`}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {r.trend === 'up' && <ArrowUpRight className="w-4 h-4 text-emerald-600 inline" />}
                      {r.trend === 'down' && <ArrowDownRight className="w-4 h-4 text-rose-600 inline" />}
                      {r.trend === 'flat' && <Minus className="w-4 h-4 text-muted-foreground inline" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}