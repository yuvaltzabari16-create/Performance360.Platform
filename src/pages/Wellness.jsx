import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader, { StatCard } from '@/components/PageHeader';
import ReadinessWidget from '@/components/ReadinessWidget';
import AthleteSelector from '@/components/AthleteSelector';
import { Card } from '@/components/ui/card';
import { HeartPulse, Moon, Battery, Zap } from 'lucide-react';

export default function Wellness() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [entries, setEntries] = useState([]);

  const load = async () => {
    if (!activeId) { setEntries([]); return; }
    const res = await base44.entities.ReadinessEntry.filter({ user_id: activeId }, { sort: '-date', limit: 30 });
    setEntries(res.items || []);
  };
  useEffect(() => { load(); }, [activeId]);

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  const latest = entries[0];
  const avg = (key) => entries.length ? (entries.reduce((s, e) => s + (e[key] || 0), 0) / entries.length).toFixed(1) : '—';

  return (
    <div>
      <PageHeader title="Training Load & Wellness" subtitle="Monitor workload, readiness, recovery and fatigue"
        actions={isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={HeartPulse} label="Readiness" value={latest?.readiness_score ?? '—'} unit="/100" />
        <StatCard icon={Moon} label="Avg sleep" value={avg('sleep_hours')} unit="h" />
        <StatCard icon={Battery} label="Avg soreness" value={avg('soreness')} unit="/10" />
        <StatCard icon={Zap} label="Avg RPE" value={avg('rpe')} unit="/10" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ReadinessWidget userId={activeId} onSaved={load} />
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Readiness History</h3>
          {entries.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No wellness data logged yet.</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{e.date}</p>
                    <p className="text-xs text-muted-foreground">{e.notes || '—'}</p>
                  </div>
                  <div className="flex gap-3 text-xs text-right">
                    <div><p className="text-muted-foreground">Ready</p><p className="font-semibold">{e.readiness_score ?? '—'}</p></div>
                    <div><p className="text-muted-foreground">Sleep</p><p className="font-semibold">{e.sleep_hours ?? '—'}h</p></div>
                    <div><p className="text-muted-foreground">RPE</p><p className="font-semibold">{e.rpe ?? '—'}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}