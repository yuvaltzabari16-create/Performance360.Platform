import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { errorMessage } from '@/lib/athleteData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { todayStr } from '@/lib/useCurrentUser';

/**
 * Schedules the selected workout through the assignWorkout function, which
 * checks every athlete's connection and gives each athlete their own copy.
 */
export default function ScheduleDialog({ open, onOpenChange, workout, teams, athletes, onScheduled }) {
  const [target, setTarget] = useState('athlete');
  const [athleteIds, setAthleteIds] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setTarget('athlete'); setAthleteIds([]); setTeamId(''); setDate(todayStr()); setError(''); }
  }, [open]);

  const toggle = (id) => setAthleteIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    if (!workout) return;
    if (target === 'athlete' && athleteIds.length === 0) { setError('Choose at least one athlete'); return; }
    if (target === 'team' && !teamId) { setError('Choose a team'); return; }
    setSaving(true); setError('');
    try {
      const res = await base44.functions.invoke('assignWorkout', {
        workout_id: workout.id, date,
        ...(target === 'athlete' ? { athlete_ids: athleteIds } : { team_id: teamId }),
      });
      const { scheduled = 0, skipped = 0 } = res.data || {};
      onScheduled?.(`Scheduled for ${scheduled} athlete(s)${skipped ? `; ${skipped} skipped (not connected)` : ''}.`);
      onOpenChange(false);
    } catch (e) { setError(errorMessage(e, 'Failed to schedule')); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule “{workout?.title}”</DialogTitle>
          <DialogDescription>Each athlete receives their own copy. Later edits to this workout do not change sessions already scheduled.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2" role="radiogroup" aria-label="Schedule for">
            {[['athlete', 'Athletes'], ['team', 'Whole team']].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={target === v} onClick={() => setTarget(v)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${target === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{l}</button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sched-date" className="text-xs">Date</Label>
            <Input id="sched-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {target === 'athlete' ? (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium mb-1">Athletes</legend>
              {athletes.length === 0 ? <p className="text-sm text-muted-foreground">No connected athletes yet.</p> : (
                <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {athletes.map((a) => (
                    <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-primary" checked={athleteIds.includes(a.id)} onChange={() => toggle(a.id)} />
                      {a.full_name || a.email}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sched-team" className="text-xs">Team</Label>
              <select id="sched-team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-9 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Choose a team…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
