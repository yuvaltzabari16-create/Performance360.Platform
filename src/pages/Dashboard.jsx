import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, todayStr } from '@/lib/useCurrentUser';
import { errorMessage } from '@/lib/athleteData';
import { normalizeWorkout, BLOCK_LABELS } from '@/lib/workoutUtils';
import PageHeader, { StatCard } from '@/components/PageHeader';
import WorkoutCard from '@/components/WorkoutCard';
import WeekCalendar from '@/components/WeekCalendar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CalendarCheck, Dumbbell, Users, Mail, AlertTriangle, Sparkles, Loader2, HeartPulse } from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useCurrentUser();
  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return null;
  return user.role === 'coach' || user.role === 'admin' ? <CoachDashboard user={user} /> : <AthleteDashboard user={user} />;
}

function ErrorBanner({ text }) {
  return text ? <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{text}</p> : null;
}

function CoachDashboard({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    base44.functions.invoke('coachOverview', { today: todayStr() })
      .then((res) => setData(res.data))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const athletes = data?.athletes || [];
  const followUp = athletes.filter((a) => a.flags.length > 0);
  const sum = (f) => athletes.reduce((n, a) => n + f(a), 0);
  const scheduled = sum((a) => a.past7.scheduled);
  const completed = sum((a) => a.past7.completed);

  return (
    <div>
      <PageHeader title={`Welcome, ${user.full_name?.split(' ')[0] || 'Coach'}`} subtitle="Your connected athletes this week" />
      <ErrorBanner text={error} />
      {!data && !error ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading overview…</div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Users} label="Connected athletes" value={athletes.length} />
            <StatCard icon={Mail} label="Pending invitations" value={data.pending_invitations} />
            <StatCard icon={CalendarCheck} label="Adherence (7 d)" value={scheduled ? Math.round((completed / scheduled) * 100) : '—'} unit={scheduled ? '%' : ''} hint={`${completed} of ${scheduled} sessions you scheduled`} />
            <StatCard icon={AlertTriangle} label="Need follow-up" value={followUp.length} />
          </div>

          {athletes.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">No connected athletes yet.</p>
              <Button asChild><Link to="/athletes">Invite athletes</Link></Button>
            </Card>
          ) : (
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <caption className="sr-only">Athlete summary for the last 7 days</caption>
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th scope="col" className="text-left font-medium px-4 py-2.5">Athlete</th>
                    <th scope="col" className="text-left font-medium px-4 py-2.5">Last check-in</th>
                    <th scope="col" className="text-right font-medium px-4 py-2.5">Sessions (7 d)</th>
                    <th scope="col" className="text-right font-medium px-4 py-2.5">Upcoming (7 d)</th>
                    <th scope="col" className="text-left font-medium px-4 py-2.5">Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {athletes.map((a) => (
                    <tr key={a.athlete_id}>
                      <td className="px-4 py-2.5 font-medium">{a.athlete_name}</td>
                      <td className="px-4 py-2.5">{a.last_checkin ? `${a.last_checkin}${a.latest_soreness !== null ? ` · soreness ${a.latest_soreness}/10` : ''}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{a.past7.completed}/{a.past7.scheduled}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{a.next7}</td>
                      <td className="px-4 py-2.5">
                        {a.flags.length ? <ul className="text-xs text-amber-500 space-y-0.5">{a.flags.map((f) => <li key={f}>{f}</li>)}</ul> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Follow-up prompts use fixed rules (no check-in for 3+ days, reported soreness of 7/10 or more, skipped or unlogged sessions). They are prompts for a conversation, not risk predictions.</p>
        </>
      )}
    </div>
  );
}

function AthleteDashboard({ user }) {
  const [workouts, setWorkouts] = useState([]);
  const [checkin, setCheckin] = useState(null);
  const [error, setError] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const today = todayStr();

  const load = async () => {
    setError('');
    try {
      const [w, r] = await Promise.all([
        base44.entities.Workout.filter({ user_id: user.id }, { sort: '-date', limit: 200 }),
        base44.entities.ReadinessEntry.filter({ user_id: user.id }, { sort: '-date', limit: 1 }),
      ]);
      setWorkouts(w.items || []);
      setCheckin(r.items?.[0] || null);
    } catch (e) { setError(errorMessage(e)); }
  };
  useEffect(() => { load(); }, [user.id]);

  const from = todayStr(new Date(Date.now() - 27 * 86400000));
  const recent = workouts.filter((w) => w.date && w.date >= from && w.date <= today);
  const completed = recent.filter((w) => w.status === 'completed').length;
  const todays = workouts.filter((w) => w.date === today);
  const overdue = workouts.filter((w) => w.date && w.date < today && w.date >= from && (w.status === 'planned' || w.status === 'in_progress'));

  const generateSession = async () => {
    setGenLoading(true); setError('');
    try {
      const res = await base44.functions.invoke('generateWorkout', { readiness: checkin?.date === today ? checkin : {}, sport: user.sport || 'football' });
      const w = res.data.workout;
      await base44.entities.Workout.create({
        user_id: user.id, owner_scope: 'personal', date: today, title: w.title,
        focus: ['strength', 'power', 'speed', 'conditioning', 'mobility', 'return_to_play', 'mixed'].includes(w.focus) ? w.focus : 'mixed',
        estimated_duration: w.estimated_duration,
        blocks: (w.blocks || []).map((b, i) => ({ ...b, id: `b${Date.now()}${i}`, label: BLOCK_LABELS[i] || `B${i + 1}` })),
        ai_generated: true, status: 'planned',
      });
      load();
    } catch (e) { setError(errorMessage(e)); }
    finally { setGenLoading(false); }
  };

  return (
    <div>
      <PageHeader title={`Welcome, ${user.full_name?.split(' ')[0] || 'Athlete'}`} subtitle="Today's training and your last four weeks" />
      <ErrorBanner text={error} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Dumbbell} label="Today" value={todays.length} unit={todays.length === 1 ? 'session' : 'sessions'} />
        <StatCard icon={CalendarCheck} label="Completed (28 d)" value={recent.length ? `${completed}/${recent.length}` : '—'} hint="Scheduled sessions completed" />
        <StatCard icon={AlertTriangle} label="Not yet logged" value={overdue.length} hint="Past sessions without a result" />
        <StatCard icon={HeartPulse} label="Last check-in" value={checkin?.date === today ? 'Today' : checkin?.date || '—'} hint={<Link className="text-primary" to="/wellness">Check in</Link>} />
      </div>
      <WeekCalendar athleteId={user.id} />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 mt-2">
        <h2 className="font-semibold">Today</h2>
        <Button size="sm" variant="outline" onClick={generateSession} disabled={genLoading}>
          {genLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          AI session draft
        </Button>
      </div>
      {todays.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No sessions scheduled for today.</div>
      ) : (
        <div className="space-y-3">{todays.map((w) => <WorkoutCard key={w.id} workout={normalizeWorkout(w)} canLog onChange={load} />)}</div>
      )}
      {overdue.length > 0 && (
        <>
          <h2 className="font-semibold mt-6 mb-3">Sessions to log</h2>
          <div className="space-y-3">{overdue.map((w) => <WorkoutCard key={w.id} workout={normalizeWorkout(w)} canLog onChange={load} />)}</div>
        </>
      )}
    </div>
  );
}
