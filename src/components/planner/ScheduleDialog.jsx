import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { todayStr } from '@/lib/useCurrentUser';

export default function ScheduleDialog({ open, onOpenChange, workout, teams, athletes }) {
  const [target, setTarget] = useState('athlete');
  const [athleteId, setAthleteId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setTarget('athlete'); setAthleteId(''); setTeamId(''); setDate(todayStr()); setError(''); }
  }, [open]);

  const save = async () => {
    if (!workout) return;
    setSaving(true); setError('');
    try {
      const base = {
        workout_id: workout.id,
        workout_title: workout.title,
        date,
      };
      if (target === 'athlete') {
        if (!athleteId) { setError('Select an athlete'); setSaving(false); return; }
        await base44.entities.WorkoutAssignment.create({ ...base, athlete_id: athleteId });
      } else {
        if (!teamId) { setError('Select a team'); setSaving(false); return; }
        await base44.entities.WorkoutAssignment.create({ ...base, team_id: teamId });
      }
      onOpenChange(false);
    } catch (e) { setError(e.message || 'Failed to schedule'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Schedule Workout</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setTarget('athlete')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${target === 'athlete' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>Single Athlete</button>
            <button onClick={() => setTarget('team')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${target === 'team' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>Whole Team</button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {target === 'athlete' ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Athlete</Label>
              <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} className="h-9 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select athlete...</option>
                {athletes.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Team</Label>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-9 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select team...</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}