import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, todayStr } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader from '@/components/PageHeader';
import AthleteSelector from '@/components/AthleteSelector';
import { TrendChart, RadarCard } from '@/components/MetricCharts';
import MetricComparison from '@/components/MetricComparison';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download } from 'lucide-react';
import { generateAthleteReport } from '@/lib/generateReport';

const CATEGORIES = ['strength', 'speed', 'endurance', 'mobility'];

export default function Performance() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [metrics, setMetrics] = useState([]);
  const [testName, setTestName] = useState('');
  const [category, setCategory] = useState('strength');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [selectedTest, setSelectedTest] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const load = async () => {
    if (!activeId) return;
    const res = await base44.entities.PerformanceMetric.filter({ user_id: activeId }, { sort: '-date', limit: 200 });
    setMetrics(res.items || []);
  };
  useEffect(() => { load(); }, [activeId]);

  const add = async () => {
    if (!testName.trim() || !value || !activeId) return;
    await base44.entities.PerformanceMetric.create({
      user_id: activeId, date: todayStr(), category, test_name: testName.trim(), value: Number(value), unit: unit.trim(),
    });
    setTestName(''); setValue(''); setUnit('');
    load();
  };

  const downloadReport = async () => {
    if (!activeId) return;
    setReportLoading(true);
    try { await generateAthleteReport(activeId, user?.full_name || 'Athlete'); }
    finally { setReportLoading(false); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  const testNames = [...new Set(metrics.map((m) => m.test_name))];
  const effectiveTest = selectedTest || testNames[0] || '';
  const trendData = metrics
    .filter((m) => m.test_name === effectiveTest)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date.slice(5), value: m.value }));

  const latestByCategory = CATEGORIES.map((c) => {
    const items = metrics.filter((m) => m.category === c).sort((a, b) => a.date.localeCompare(b.date));
    return { category: c.charAt(0).toUpperCase() + c.slice(1), value: items[items.length - 1]?.value ?? 0 };
  });

  return (
    <div>
      <PageHeader title="Performance Testing" subtitle="Longitudinal strength, speed and endurance benchmarks"
        actions={
          <div className="flex items-center gap-2">
            {isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />}
            <Button variant="outline" onClick={downloadReport} disabled={!activeId || reportLoading}>
              <Download className="w-4 h-4 mr-1.5" /> {reportLoading ? 'Building…' : 'Download Report'}
            </Button>
          </div>
        } />

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Trend</h3>
            {testNames.length > 0 && (
              <Select value={effectiveTest} onValueChange={setSelectedTest}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {testNames.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {trendData.length > 0 ? <TrendChart data={trendData} />
            : <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Log a test to see trends.</div>}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Profile</h3>
          {metrics.length > 0 ? <RadarCard data={latestByCategory} />
            : <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No data yet.</div>}
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h3 className="font-semibold mb-3">Log a Test</h3>
        <div className="grid sm:grid-cols-5 gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Test name (e.g. Back Squat 1RM)" value={testName} onChange={(e) => setTestName(e.target.value)} />
          <Input type="number" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
          <Input placeholder="Unit (kg, s, m)" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <Button onClick={add} disabled={!testName || !value}><Plus className="w-4 h-4 mr-1.5" /> Log</Button>
        </div>
      </Card>

      <h3 className="font-semibold mb-3 mt-2">Date Comparison</h3>
      <div className="mb-6">
        <MetricComparison athleteId={activeId} />
      </div>

      <h3 className="font-semibold mb-3">History</h3>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Date</th>
              <th className="text-left font-medium px-4 py-2.5">Category</th>
              <th className="text-left font-medium px-4 py-2.5">Test</th>
              <th className="text-right font-medium px-4 py-2.5">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {metrics.slice(0, 20).map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5">{m.date}</td>
                <td className="px-4 py-2.5 capitalize">{m.category}</td>
                <td className="px-4 py-2.5">{m.test_name}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{m.value} {m.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}