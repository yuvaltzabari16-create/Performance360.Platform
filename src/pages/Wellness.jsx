import { useEffect, useMemo, useState } from 'react';
import { useCurrentUser, todayStr } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import { fetchAthleteRecords, errorMessage } from '@/lib/athleteData';
import PageHeader, { StatCard } from '@/components/PageHeader';
import ReadinessWidget from '@/components/ReadinessWidget';
import AthleteSelector from '@/components/AthleteSelector';
import { Card } from '@/components/ui/card';
import { Moon, Battery, Gauge, CalendarCheck } from 'lucide-react';

/** Mean of the values that were actually reported. */
const meanOf = (rows, key) => {
  const v = rows.map((r) => r[key]).filter((x) => typeof x === 'number' && Number.isFinite(x));
  return v.length ? { value: (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), n: v.length } : null;
};

export default function Wellness() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [entries, setEntries] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    if (!activeId || !user) { setEntries([]); setWorkouts([]); return; }
    setError('');
    try {
      const [r, w] = await Promise.all([
        fetchAthleteRecords(user, activeId, 'ReadinessEntry', { sort: '-date', limit: 60 }),
        fetchAthleteRecords(user, activeId, 'Workout', { sort: '-date', limit: 200 }),
      ]);
      setEntries(r); setWorkouts(w);
    } catch (e) { setError(errorMessage(e)); }
  };
  useEffect(() => { load(); }, [activeId, user?.id]);

  const week = useMemo(() => {
    const from = todayStr(new Date(Date.now() - 6 * 86400000));
    const to = todayStr();
    const rows = entries.filter((e) => e.date >= from && e.date <= to);
    const sessions = workouts.filter((w) => w.date >= from && w.date <= to && w.status === 'completed');
    const loads = sessions.map((w) => w.athlete_result?.session_load).filter((x) => typeof x === 'number');
    return {
      rows, sessions,
      sleep: meanOf(rows, 'sleep_hours'), soreness: meanOf(rows, 'soreness'),
      load: loads.length ? loads.reduce((a, b) => a + b, 0) : null, loadN: loads.length,
    };
  }, [entries, workouts]);

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;
  const own = activeId && activeId === user?.id;

  return (
    <div>
      <PageHeader title="Training Load & Wellness" subtitle="Daily check-ins and session load (session RPE × minutes) over the last 7 days"
        actions={isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />} />
      {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {!activeId ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Select a connected athlete.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard icon={CalendarCheck} label="Check-ins (7 d)" value={week.rows.length} unit="/ 7" />
            <StatCard icon={Moon} label="Avg sleep (7 d)" value={week.sleep?.value ?? '—'} unit={week.sleep ? 'h' : ''} hint={week.sleep ? `${week.sleep.n} reports` : 'Not reported'} />
            <StatCard icon={Battery} label="Avg soreness (7 d)" value={week.soreness?.value ?? '—'} unit={week.soreness ? '/10' : ''} hint={week.soreness ? `${week.soreness.n} reports` : 'Not reported'} />
            <StatCard icon={Gauge} label="Session load (7 d)" value={week.load ?? '—'} unit={week.load !== null ? 'AU' : ''}
              hint={`${week.sessions.length} completed session(s), ${week.loadN} with RPE and duration`} />
          </div>

          <div className={`grid gap-6 ${own ? 'lg:grid-cols-2' : ''}`}>
            {own && <ReadinessWidget onSaved={load} />}
            <Card className="p-5">
              <h2 className="font-semibold mb-3">Check-in history</h2>
              {entries.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No check-ins recorded yet.</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                  {entries.map((e) => (
                    <div key={e.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{e.date}</p>
                        {e.notes && <p className="text-xs text-muted-foreground break-words">{e.notes}</p>}
                      </div>
                      <dl className="grid grid-cols-4 gap-3 text-xs text-right shrink-0">
                        <div><dt className="text-muted-foreground">Sleep</dt><dd className="font-semibold">{e.sleep_hours ?? '—'}</dd></div>
                        <div><dt className="text-muted-foreground">Sore</dt><dd className="font-semibold">{e.soreness ?? '—'}</dd></div>
                        <div><dt className="text-muted-foreground">Mood</dt><dd className="font-semibold">{e.mood ?? '—'}</dd></div>
                        <div><dt className="text-muted-foreground">RPE</dt><dd className="font-semibold">{e.rpe ?? '—'}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Session load uses the session-RPE method (Foster et al., 2001) and is only counted when the athlete logged both RPE and duration. These figures support coaching conversations; they are not a medical or injury-risk assessment.</p>
        </>
      )}
    </div>
  );
}
