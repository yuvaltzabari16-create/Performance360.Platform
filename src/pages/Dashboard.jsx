import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, todayStr } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader, { StatCard } from '@/components/PageHeader';
import WorkoutCard from '@/components/WorkoutCard';
import AthleteSelector from '@/components/AthleteSelector';
import TemplateManager from '@/components/TemplateManager';
import WeekCalendar from '@/components/WeekCalendar';
import { Button } from '@/components/ui/button';
import { HeartPulse, Video, Activity, Dumbbell, Sparkles } from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [readiness, setReadiness] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [latestMovement, setLatestMovement] = useState(null);
  const [sessionsDone, setSessionsDone] = useState(0);
  const [genLoading, setGenLoading] = useState(false);

  const loadAll = async () => {
    if (!activeId) return;
    const [r, w, m, c] = await Promise.all([
      base44.entities.ReadinessEntry.filter({ user_id: activeId }, { sort: '-date', limit: 1 }),
      base44.entities.Workout.filter({ user_id: activeId, date: todayStr() }, { sort: '-created_date', limit: 10 }),
      base44.entities.MovementAnalysis.filter({ user_id: activeId, status: 'completed' }, { sort: '-created_date', limit: 1 }),
      base44.entities.Workout.count({ user_id: activeId, status: 'completed' }),
    ]);
    setReadiness(r.items?.[0] || null);
    setWorkouts(w.items || []);
    setLatestMovement(m.items?.[0] || null);
    setSessionsDone(typeof c === 'number' ? c : 0);
  };

  useEffect(() => { if (activeId) loadAll(); }, [activeId]);

  const generateSession = async () => {
    setGenLoading(true);
    try {
      const res = await base44.functions.invoke('generateWorkout', {
        readiness: readiness || {}, sport: user?.sport || 'general',
      });
      const w = res.data.workout;
      await base44.entities.Workout.create({
        user_id: activeId, date: todayStr(), title: w.title,
        exercises: w.exercises, ai_generated: true, status: 'planned',
      });
      loadAll();
    } finally { setGenLoading(false); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.full_name?.split(' ')[0] || 'Athlete'}`}
        subtitle="Your daily training overview"
        actions={isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={HeartPulse} label="Readiness" value={readiness?.readiness_score ?? '—'} unit="/100" />
        <StatCard icon={Dumbbell} label="Today" value={workouts.length || '—'} unit={workouts.length === 1 ? 'session' : 'sessions'} />
        <StatCard icon={Video} label="Movement" value={latestMovement?.score ?? '—'} unit="/100" />
        <StatCard icon={Activity} label="Sessions done" value={sessionsDone} />
      </div>
      <WeekCalendar athleteId={activeId} />
      <div className="flex items-center justify-between mb-3 mt-2">
        <h2 className="font-semibold">Today's Agenda</h2>
        <Button size="sm" variant="outline" onClick={generateSession} disabled={genLoading || !activeId}>
          <Sparkles className="w-4 h-4 mr-1.5" /> {genLoading ? 'Generating…' : 'Generate AI Session'}
        </Button>
      </div>
      {workouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No sessions scheduled. Generate an AI-adapted session above.
        </div>
      ) : (
        <div className="space-y-3">{workouts.map((w) => <WorkoutCard key={w.id} workout={w} onChange={loadAll} />)}</div>
      )}
      {isCoach && <TemplateManager coachId={user.id} athleteId={activeId} onApplied={loadAll} />}
    </div>
  );
}