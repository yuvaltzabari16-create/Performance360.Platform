import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react';
import { todayStr } from '@/lib/useCurrentUser';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfWeek(d) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
// Local calendar date; toISOString() would shift dates for users east of UTC.
const toStr = (d) => todayStr(d);
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const STATUS_DOT = {
  planned: 'bg-slate-300',
  in_progress: 'bg-primary',
  completed: 'bg-emerald-500',
  skipped: 'bg-rose-400',
};

export default function WeekCalendar({ athleteId }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const today = toStr(new Date());

  useEffect(() => {
    if (!athleteId) return;
    setLoading(true);
    base44.entities.Workout.filter(
      { user_id: athleteId, date: { $gte: toStr(weekStart), $lte: toStr(weekEnd) } },
      { sort: 'date', limit: 100 }
    ).then((res) => setWorkouts(res.items || [])).catch(() => setWorkouts([])).finally(() => setLoading(false));
  }, [athleteId, toStr(weekStart)]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const ds = toStr(date);
    return { date, ds, label: DOW[i], dayNum: date.getDate(), isToday: ds === today, items: workouts.filter((w) => w.date === ds) };
  });

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="font-semibold flex items-center gap-2"><Dumbbell className="w-4 h-4 text-primary" /> This Week</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">{weekLabel}</span>
          <Button size="icon" variant="ghost" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
          <Button size="icon" variant="ghost" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
      <div className="overflow-x-auto -mx-1 px-1">
      <div className="grid grid-cols-7 gap-2 min-w-[560px]">
        {days.map((d) => (
          <div key={d.ds} className={`rounded-lg border p-2 min-h-[96px] flex flex-col ${d.isToday ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">{d.label}</span>
              <span className={`text-sm font-semibold ${d.isToday ? 'text-primary' : ''}`}>{d.dayNum}</span>
            </div>
            <div className="space-y-1 flex-1">
              {d.items.map((w) => (
                <div key={w.id} className="rounded-md bg-secondary/70 px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[w.status] || 'bg-slate-300'}`} />
                    <p className="text-[11px] font-medium leading-tight line-clamp-2">{w.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
      {loading && <p className="text-xs text-muted-foreground mt-2">Loading…</p>}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
        {Object.entries(STATUS_DOT).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${v}`} /> {k.replace('_', ' ')}</span>
        ))}
      </div>
    </Card>
  );
}