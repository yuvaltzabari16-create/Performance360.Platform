import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check, Loader2 } from 'lucide-react';
import { todayStr } from '@/lib/useCurrentUser';
import { errorMessage } from '@/lib/athleteData';

const FIELDS = [
  { key: 'sleep_hours', label: 'Sleep last night', unit: 'hours', min: 0, max: 24, step: 0.5, help: 'Total hours slept' },
  { key: 'soreness', label: 'Muscle soreness', unit: '1–10', min: 1, max: 10, step: 1, help: '1 = none, 10 = extreme' },
  { key: 'mood', label: 'Mood', unit: '1–10', min: 1, max: 10, step: 1, help: '1 = very low, 10 = excellent' },
  { key: 'rpe', label: "Yesterday's session RPE", unit: '0–10', min: 0, max: 10, step: 1, help: 'CR-10 scale; leave blank if you did not train' },
];

/**
 * Daily wellness self-report. Values the athlete leaves blank are stored as
 * "not reported" — nothing is pre-filled or estimated.
 */
export default function ReadinessWidget({ onSaved }) {
  const empty = { sleep_hours: '', soreness: '', mood: '', rpe: '', notes: '' };
  const [values, setValues] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => { setDone(false); setValues((s) => ({ ...s, [k]: v })); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { kind: 'readiness', date: todayStr(), notes: values.notes || undefined };
      for (const f of FIELDS) if (values[f.key] !== '') payload[f.key] = Number(values[f.key]);
      await base44.functions.invoke('recordMetric', payload);
      setDone(true);
      onSaved?.();
    } catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">Today’s check-in</h2>
      <p className="text-xs text-muted-foreground mb-4">One check-in per day; saving again updates today’s entry. Shared with your connected coaches.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`rw-${f.key}`}>{f.label} <span className="text-muted-foreground font-normal">({f.unit})</span></Label>
            <input id={`rw-${f.key}`} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step}
              value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" aria-describedby={`rw-${f.key}-h`} />
            <span id={`rw-${f.key}-h`} className="text-[11px] text-muted-foreground">{f.help}</span>
          </div>
        ))}
      </div>
      <Label htmlFor="rw-notes" className="mt-4 block">Notes for your coach</Label>
      <textarea id="rw-notes" value={values.notes} maxLength={1000} onChange={(e) => set('notes', e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" rows={2} />
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full mt-4">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : done ? <Check className="w-4 h-4 mr-2" /> : null}
        {done ? 'Saved' : 'Save check-in'}
      </Button>
    </form>
  );
}
