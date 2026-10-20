import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Moon, Activity, Smile, Zap, Check } from 'lucide-react';
import { todayStr } from '@/lib/useCurrentUser';

function Slider({ icon: Icon, label, value, set, min, max, suffix }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icon className="w-4 h-4 text-primary" /> {label}
        </span>
        <span className="text-sm font-semibold tabular-nums">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

export default function ReadinessWidget({ userId, onSaved }) {
  const [sleep, setSleep] = useState(7);
  const [soreness, setSoreness] = useState(3);
  const [mood, setMood] = useState(6);
  const [rpe, setRpe] = useState(5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const score = Math.round(Math.max(0, Math.min(100,
    100 - soreness * 6 - (8 - sleep) * 4 - (10 - mood) * 3 - Math.abs(rpe - 5) * 4
  )));
  const scoreColor = score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-500' : 'text-rose-500';

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.ReadinessEntry.create({
        user_id: userId, date: todayStr(),
        sleep_hours: sleep, soreness, mood, rpe, readiness_score: score, notes,
      });
      setDone(true);
      onSaved?.();
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Daily Readiness</h3>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Readiness score</p>
          <p className={`text-2xl font-semibold tabular-nums ${scoreColor}`}>{score}<span className="text-sm text-muted-foreground">/100</span></p>
        </div>
      </div>
      <div className="space-y-4">
        <Slider icon={Moon} label="Sleep" value={sleep} set={setSleep} min={0} max={12} suffix="h" />
        <Slider icon={Activity} label="Soreness" value={soreness} set={setSoreness} min={0} max={10} />
        <Slider icon={Smile} label="Mood" value={mood} set={setMood} min={0} max={10} />
        <Slider icon={Zap} label="Yesterday RPE" value={rpe} set={setRpe} min={0} max={10} />
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for your coach…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
          rows={2}
        />
      </div>
      <Button onClick={save} disabled={saving || done} className="w-full mt-4">
        {done ? <><Check className="w-4 h-4 mr-2" /> Logged</> : saving ? 'Saving…' : 'Log Readiness'}
      </Button>
    </div>
  );
}