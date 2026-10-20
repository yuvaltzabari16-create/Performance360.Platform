import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { errorMessage } from '@/lib/athleteData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Circle, CheckCircle2, Play, Dumbbell, Loader2, RotateCcw } from 'lucide-react';

const STATUS_STYLE = {
  completed: 'bg-emerald-500/15 text-emerald-500',
  in_progress: 'bg-primary/15 text-primary',
  locked: 'bg-secondary text-muted-foreground',
};

/**
 * One rehab phase. Coaches start phases and record clearance (with the name
 * of the professional responsible). Athletes can only tick off exercises in
 * a phase that has been started.
 */
export default function MilestoneCard({ milestone, blocks, canManage, isOwner, athleteId, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearedBy, setClearedBy] = useState('');
  const [note, setNote] = useState('');
  const [checks, setChecks] = useState({});

  const run = async (payload) => {
    setBusy(true); setError('');
    try { await base44.functions.invoke('manageRehab', payload); setClearing(false); onUpdated?.(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const setStatus = (status, extra = {}) => run({ action: 'set_status', athlete_id: athleteId, milestone_id: milestone.id, status, ...extra });

  const criteria = milestone.required_tests || [];
  const allChecked = criteria.every((_, i) => checks[i]);
  const icon = milestone.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    : milestone.status === 'in_progress' ? <Circle className="w-5 h-5 text-primary" />
    : <Lock className="w-5 h-5 text-muted-foreground" />;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5" aria-hidden>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Phase {milestone.order}: {milestone.title}</h3>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[milestone.status] || STATUS_STYLE.locked}`}>{(milestone.status || 'locked').replace('_', ' ')}</span>
          </div>
          {milestone.description && <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>}

          {criteria.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progression criteria</p>
              <ul className="mt-1 list-disc pl-5 text-sm space-y-0.5">{criteria.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}

          {milestone.status === 'completed' && milestone.cleared_by_name && (
            <p className="mt-3 text-xs text-muted-foreground">
              Cleared by <span className="font-medium text-foreground">{milestone.cleared_by_name}</span>
              {milestone.cleared_at ? ` on ${milestone.cleared_at.slice(0, 10)}` : ''}{milestone.clearance_note ? ` — ${milestone.clearance_note}` : ''}
            </p>
          )}

          {blocks?.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Dumbbell className="w-3.5 h-3.5" /> Exercises</p>
              {blocks.map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 bg-secondary/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{b.title}</p>
                    {b.instructions && <p className="text-xs text-muted-foreground mt-0.5">{b.instructions}</p>}
                  </div>
                  {b.status === 'completed' ? <span className="text-xs text-emerald-500 shrink-0">Done</span>
                    : b.status === 'unlocked' && isOwner ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ action: 'complete_exercise', block_id: b.id })}>Mark done</Button>
                    ) : <span className="text-xs text-muted-foreground shrink-0">{b.status === 'unlocked' ? 'Available' : 'Locked'}</span>}
                </div>
              ))}
            </div>
          )}

          {canManage && (
            <div className="mt-4 flex flex-wrap gap-2">
              {milestone.status === 'locked' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('in_progress')}><Play className="w-4 h-4 mr-1.5" /> Start phase</Button>
              )}
              {milestone.status === 'in_progress' && !clearing && (
                <Button size="sm" disabled={busy} onClick={() => setClearing(true)}><CheckCircle2 className="w-4 h-4 mr-1.5" /> Record clearance…</Button>
              )}
              {milestone.status !== 'locked' && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus(milestone.status === 'completed' ? 'in_progress' : 'locked')}>
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Reopen
                </Button>
              )}
            </div>
          )}

          {clearing && (
            <form className="mt-4 rounded-lg border border-border p-4 space-y-3"
              onSubmit={(e) => { e.preventDefault(); setStatus('completed', { cleared_by_name: clearedBy, clearance_note: note || undefined }); }}>
              <p className="text-sm">Record the decision made by the responsible professional. Performance360 does not decide clearance.</p>
              {criteria.map((t, i) => (
                <label key={i} className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={!!checks[i]} onChange={(e) => setChecks((s) => ({ ...s, [i]: e.target.checked }))} className="w-4 h-4 accent-primary" />
                  Criterion assessed: {t}
                </label>
              ))}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`cb-${milestone.id}`}>Cleared by (name and role)</Label>
                <Input id={`cb-${milestone.id}`} required maxLength={120} value={clearedBy} onChange={(e) => setClearedBy(e.target.value)} placeholder="e.g. Dana Levi, club physiotherapist" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`cn-${milestone.id}`}>Note (optional)</Label>
                <Input id={`cn-${milestone.id}`} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy || !clearedBy.trim() || !allChecked}>{busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Save clearance</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setClearing(false)}>Cancel</Button>
              </div>
            </form>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
      </div>
    </Card>
  );
}
