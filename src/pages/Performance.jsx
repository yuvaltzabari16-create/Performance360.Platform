import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, todayStr } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import { fetchAthleteRecords, errorMessage } from '@/lib/athleteData';
import { METRICS, getMetric, changeVsPrevious } from '../../base44/shared/metrics.ts';
import PageHeader from '@/components/PageHeader';
import AthleteSelector from '@/components/AthleteSelector';
import { TrendChart } from '@/components/MetricCharts';
import MetricComparison from '@/components/MetricComparison';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download, Loader2, Info } from 'lucide-react';
import { generateAthleteReport } from '@/lib/generateReport';

const CATEGORY_LABEL = {
  speed: 'Speed', power: 'Jumps & power', strength: 'Strength', change_of_direction: 'Change of direction',
  endurance: 'Aerobic', repeated_sprint: 'Repeated sprint', mobility: 'Mobility',
};
const CATEGORIES = Object.keys(CATEGORY_LABEL);

/** Series key: catalog key (+ side), or the free-text name for legacy records. */
const seriesKey = (m) => (m.metric_key ? m.metric_key + (m.side ? ':' + m.side : '') : 'legacy:' + m.test_name);
const seriesLabel = (m) => {
  const def = m.metric_key && getMetric(m.metric_key);
  const name = def ? def.label : m.test_name;
  return m.side ? `${name} (${m.side})` : name;
};

export default function Performance() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [metrics, setMetrics] = useState([]);
  const [loadState, setLoadState] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ metric_key: '', value: '', date: todayStr(), side: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const load = async () => {
    if (!activeId || !user) { setMetrics([]); return; }
    setLoadState('loading'); setLoadError('');
    try {
      setMetrics(await fetchAthleteRecords(user, activeId, 'PerformanceMetric', { sort: '-date', limit: 500 }));
      setLoadState('ready');
    } catch (e) { setLoadError(errorMessage(e)); setLoadState('error'); }
  };
  useEffect(() => { load(); }, [activeId, user?.id]);

  const def = form.metric_key ? getMetric(form.metric_key) : null;

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!def) { setFormError('Choose a test'); return; }
    setSaving(true);
    try {
      await base44.functions.invoke('recordMetric', {
        kind: 'metric', athlete_id: activeId, metric_key: def.key, value: form.value,
        date: form.date, side: def.sided ? form.side : undefined, notes: form.notes || undefined,
      });
      setForm((f) => ({ ...f, value: '', notes: '' }));
      load();
    } catch (err) { setFormError(errorMessage(err)); }
    finally { setSaving(false); }
  };

  const series = useMemo(() => {
    const map = new Map();
    for (const m of metrics) {
      const k = seriesKey(m);
      if (!map.has(k)) map.set(k, { key: k, label: seriesLabel(m), unit: m.unit, items: [] });
      map.get(k).items.push(m);
    }
    for (const s of map.values()) s.items.sort((a, b) => a.date.localeCompare(b.date) || (a.created_date || '').localeCompare(b.created_date || ''));
    return [...map.values()];
  }, [metrics]);

  const active = series.find((s) => s.key === selectedSeries) || series[0];
  const trendData = (active?.items || []).map((m) => ({ date: m.date, value: m.value }));

  // Change versus the previous result of the same test and side.
  const previousOf = useMemo(() => {
    const out = {};
    for (const s of series) s.items.forEach((m, i) => { out[m.id] = s.items[i - 1]; });
    return out;
  }, [series]);

  const downloadReport = async () => {
    if (!activeId) return;
    setReportLoading(true);
    try { await generateAthleteReport(user, activeId); }
    catch (e) { setLoadError(errorMessage(e, 'Could not build the report')); }
    finally { setReportLoading(false); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="Testing & Performance" subtitle="Record physical tests and follow each athlete against their own history"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />}
            <Button variant="outline" onClick={downloadReport} disabled={!activeId || reportLoading}>
              {reportLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
              PDF report
            </Button>
          </div>
        } />

      {!activeId ? (
        <EmptyState text={isCoach ? 'Select a connected athlete to view their testing history.' : 'Your profile is still loading.'} />
      ) : (
        <>
          {loadError && <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{loadError}</p>}

          <Card className="p-5 mb-6">
            <h2 className="font-semibold mb-3">Record a test result</h2>
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] items-end">
              <div className="flex flex-col gap-1.5 min-w-0">
                <Label htmlFor="metric">Test</Label>
                <Select value={form.metric_key || undefined} onValueChange={(v) => setForm((f) => ({ ...f, metric_key: v, side: '' }))}>
                  <SelectTrigger id="metric"><SelectValue placeholder="Choose a test" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectGroup key={c}>
                        <SelectLabel>{CATEGORY_LABEL[c]}</SelectLabel>
                        {METRICS.filter((m) => m.category === c).map((m) => (
                          <SelectItem key={m.key} value={m.key}>{m.label} ({m.unit})</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="value">Result{def ? ` (${def.unit})` : ''}</Label>
                <Input id="value" type="number" inputMode="decimal" step="any" required
                  min={def?.min} max={def?.max} value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date">Test date</Label>
                <Input id="date" type="date" required max={todayStr()} value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="side">Side</Label>
                <select id="side" disabled={!def?.sided} required={!!def?.sided} value={form.side}
                  onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50">
                  <option value="">{def?.sided ? 'Choose…' : 'n/a'}</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <Button type="submit" disabled={saving || !def}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}Save
              </Button>
              <div className="md:col-span-5 flex flex-col gap-1.5">
                <Label htmlFor="notes">Notes (device, conditions, trial details)</Label>
                <Input id="notes" maxLength={1000} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </form>
            {def && (
              <p className="mt-3 flex gap-2 text-xs text-muted-foreground"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{def.protocol}</p>
            )}
            {formError && <p role="alert" className="mt-3 text-sm text-destructive">{formError}</p>}
          </Card>

          <Card className="p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold">Trend</h2>
              {series.length > 0 && (
                <Select value={active?.key} onValueChange={setSelectedSeries}>
                  <SelectTrigger className="w-64" aria-label="Test to chart"><SelectValue /></SelectTrigger>
                  <SelectContent>{series.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            {loadState === 'loading' ? <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading…</div>
              : trendData.length > 1 ? <TrendChart data={trendData} unit={active?.unit} />
              : <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                  {trendData.length === 1 ? 'One result recorded. A trend appears after the next test.' : 'No results recorded yet.'}
                </div>}
          </Card>

          <h2 className="font-semibold mb-3">Compare two dates</h2>
          <div className="mb-6"><MetricComparison metrics={metrics} /></div>

          <h2 className="font-semibold mb-3">History</h2>
          {metrics.length === 0 ? <EmptyState text="No test results recorded yet." /> : (
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th scope="col" className="text-left font-medium px-4 py-2.5">Date</th>
                    <th scope="col" className="text-left font-medium px-4 py-2.5">Test</th>
                    <th scope="col" className="text-right font-medium px-4 py-2.5">Result</th>
                    <th scope="col" className="text-right font-medium px-4 py-2.5">vs previous</th>
                    <th scope="col" className="text-left font-medium px-4 py-2.5">Recorded by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {metrics.slice(0, 100).map((m) => {
                    const d = m.metric_key && getMetric(m.metric_key);
                    const prev = previousOf[m.id];
                    const ch = d && prev ? changeVsPrevious(d, m, prev) : undefined;
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-2.5 whitespace-nowrap">{m.date}</td>
                        <td className="px-4 py-2.5">{seriesLabel(m)}{m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums whitespace-nowrap">{m.value} {m.unit}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${ch ? (ch.delta > 0 ? 'text-emerald-500' : ch.delta < 0 ? 'text-rose-500' : '') : 'text-muted-foreground'}`}>
                          {ch ? `${ch.percent > 0 ? '+' : ''}${ch.percent}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-muted-foreground">{m.source || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">“vs previous” compares with this athlete’s previous result for the same test and side. Positive means improved (faster times count as improvements). No external norms are applied.</p>
        </>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
