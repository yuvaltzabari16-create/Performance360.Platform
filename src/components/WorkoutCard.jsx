import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeWorkout } from '@/lib/workoutUtils';
import { errorMessage } from '@/lib/athleteData';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Check, Loader2, SkipForward, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_STYLES = {
  planned: 'bg-secondary text-muted-foreground',
  in_progress: 'bg-primary/15 text-primary',
  completed: 'bg-emerald-500/15 text-emerald-500',
  skipped: 'bg-rose-500/15 text-rose-500',
};

const PRESCRIPTION = ['sets', 'reps', 'load', 'rpe', 'rir', 'tempo', 'rest', 'time', 'distance'];
const prescriptionText = (it) => PRESCRIPTION
  .filter((k) => it[k] !== undefined && it[k] !== null && it[k] !== '')
  .map((k) => (k === 'sets' ? `${it[k]} sets` : k === 'reps' ? `${it[k]} reps` : `${k.toUpperCase()} ${it[k]}`))
  .join(' · ');

/**
 * A scheduled session. Shows the coach's prescription and, separately, what
 * the athlete recorded. Only the athlete it belongs to can log results.
 */
export default function WorkoutCard({ workout: raw, canLog, onChange }) {
  const workout = normalizeWorkout(raw);
  const [open, setOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const [rpe, setRpe] = useState('');
  const [minutes, setMinutes] = useState(workout.estimated_duration ? String(workout.estimated_duration) : '');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const result = workout.athlete_result;
  const done = workout.status === 'completed' || workout.status === 'skipped';
  const resultFor = (blockId, idx) => result?.item_results?.find((r) => r.block_id === blockId && r.item_index === idx);

  const submit = async (status) => {
    setSaving(true); setError('');
    try {
      const item_results = Object.entries(items).map(([k, v]) => {
        const [block_id, idx] = k.split('|');
        return { block_id, item_index: Number(idx), ...v };
      }).filter((r) => r.sets_done !== undefined || r.reps_done || r.load_used || r.note);
      const res = await base44.functions.invoke('completeWorkout', {
        workout_id: workout.id, status,
        session_rpe: rpe === '' ? undefined : Number(rpe),
        duration_min: minutes === '' ? undefined : Number(minutes),
        notes: notes || undefined,
        item_results: status === 'completed' ? item_results : [],
      });
      setLogging(false);
      onChange?.(res.data?.workout);
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  };

  const setItem = (blockId, idx, patch) => setItems((s) => {
    const k = `${blockId}|${idx}`;
    return { ...s, [k]: { ...(s[k] || {}), ...patch } };
  });

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold flex flex-wrap items-center gap-2">
            {workout.title}
            {workout.ai_generated && <Badge variant="outline" className="text-primary border-primary/30 gap-1"><Sparkles className="w-3 h-3" aria-hidden /> AI draft</Badge>}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {workout.date || 'Unscheduled'}{workout.estimated_duration ? ` · ~${workout.estimated_duration} min` : ''}{workout.owner_scope === 'assigned' ? ' · from your coach' : ''}
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[workout.status] || STATUS_STYLES.planned}`}>{(workout.status || 'planned').replace('_', ' ')}</span>
      </div>

      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {open ? 'Hide' : 'Show'} session ({workout.blocks.reduce((n, b) => n + (b.items?.length || 0), 0)} exercises)
      </button>

      {(open || logging) && (
        <div className="mt-3 space-y-3">
          {workout.blocks.map((b) => (
            <div key={b.id} className="rounded-lg border border-border">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
                {b.label} · {String(b.type || 'straight_sets').replace('_', ' ')}{b.rounds > 1 ? ` × ${b.rounds} rounds` : ''}
              </p>
              <ul className="divide-y divide-border">
                {(b.items || []).map((it, idx) => {
                  const r = resultFor(b.id, idx);
                  return (
                    <li key={idx} className="px-3 py-2.5">
                      <p className="text-sm font-medium">{it.label} {it.exercise_name || 'Exercise'}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-medium">Target:</span> {prescriptionText(it) || '—'}</p>
                      {it.note && <p className="text-xs text-muted-foreground italic">{it.note}</p>}
                      {r && (
                        <p className="text-xs mt-0.5"><span className="font-medium text-emerald-500">Done:</span> {[r.sets_done !== undefined && `${r.sets_done} sets`, r.reps_done && `${r.reps_done} reps`, r.load_used].filter(Boolean).join(' · ') || '—'}{r.note ? ` — ${r.note}` : ''}</p>
                      )}
                      {logging && (
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <Input aria-label={`${it.exercise_name} sets done`} type="number" min={0} max={50} placeholder="Sets done"
                            onChange={(e) => setItem(b.id, idx, { sets_done: e.target.value === '' ? undefined : Number(e.target.value) })} />
                          <Input aria-label={`${it.exercise_name} reps done`} maxLength={40} placeholder="Reps done" onChange={(e) => setItem(b.id, idx, { reps_done: e.target.value })} />
                          <Input aria-label={`${it.exercise_name} load used`} maxLength={40} placeholder="Load used" onChange={(e) => setItem(b.id, idx, { load_used: e.target.value })} />
                          <Input aria-label={`${it.exercise_name} note`} maxLength={500} placeholder="Note" onChange={(e) => setItem(b.id, idx, { note: e.target.value })} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {workout.notes && <p className="text-sm text-muted-foreground"><span className="font-medium">Coach notes:</span> {workout.notes}</p>}
        </div>
      )}

      {result && done && (
        <div className="mt-4 rounded-lg bg-secondary/50 p-3 text-sm">
          <p className="font-medium">Athlete-recorded {workout.status === 'skipped' ? '(skipped)' : 'result'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[result.session_rpe !== undefined && `Session RPE ${result.session_rpe}/10`, result.duration_min && `${result.duration_min} min`, result.session_load !== undefined && `Load ${result.session_load} AU`].filter(Boolean).join(' · ') || 'No RPE or duration recorded'}
            {workout.completed_at ? ` · logged ${workout.completed_at.slice(0, 10)}` : ''}
          </p>
          {result.notes && <p className="mt-1">{result.notes}</p>}
        </div>
      )}

      {canLog && !done && (
        logging ? (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`rpe-${workout.id}`}>Session RPE (0–10)</Label>
                <Input id={`rpe-${workout.id}`} type="number" min={0} max={10} step={1} value={rpe} onChange={(e) => setRpe(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`min-${workout.id}`}>Duration (minutes)</Label>
                <Input id={`min-${workout.id}`} type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`notes-${workout.id}`}>Feedback for your coach</Label>
              <textarea id={`notes-${workout.id}`} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => submit('completed')} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}Save as completed</Button>
              <Button size="sm" variant="outline" onClick={() => submit('skipped')} disabled={saving}><SkipForward className="w-4 h-4 mr-1.5" />Mark skipped</Button>
              <Button size="sm" variant="ghost" onClick={() => setLogging(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" className="mt-4" onClick={() => setLogging(true)}><Check className="w-4 h-4 mr-1.5" /> Log this session</Button>
        )
      )}
    </Card>
  );
}
