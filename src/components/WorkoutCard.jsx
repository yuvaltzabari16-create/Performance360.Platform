import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Dumbbell, Check, Lock, Pencil, Bookmark } from 'lucide-react';

const STATUS_STYLES = {
  planned: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-50 text-primary',
  completed: 'bg-emerald-50 text-emerald-600',
  skipped: 'bg-rose-50 text-rose-500',
};

export default function WorkoutCard({ workout, onChange }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(workout.title);
  const [notes, setNotes] = useState(workout.notes || '');
  const [saving, setSaving] = useState(false);
  const [templated, setTemplated] = useState(false);

  const saveAsTemplate = async () => {
    setSaving(true);
    try {
      await base44.entities.WorkoutTemplate.create({
        name: workout.title,
        exercises: workout.exercises || [],
      });
      setTemplated(true);
      setTimeout(() => setTemplated(false), 2000);
    } finally { setSaving(false); }
  };

  const cycleStatus = async (status) => {
    const order = ['planned', 'in_progress', 'completed'];
    const next = order[(order.indexOf(workout.status) + 1) % order.length];
    const updated = await base44.entities.Workout.update(workout.id, { status: next });
    onChange?.(updated);
  };

  const toggleOverride = async () => {
    const updated = await base44.entities.Workout.update(workout.id, { coach_override: !workout.coach_override });
    onChange?.(updated);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.Workout.update(workout.id, { title, notes, coach_override: true });
      onChange?.(updated);
      setEditing(false);
    } finally { setSaving(false); }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {editing ? (
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-semibold bg-transparent border-b border-input focus:outline-none" />
          ) : (
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {workout.title}
              {workout.ai_generated && !workout.coach_override && (
                <Badge variant="outline" className="text-primary border-primary/30 gap-1"><Sparkles className="w-3 h-3" /> AI</Badge>
              )}
              {workout.coach_override && (
                <Badge variant="outline" className="text-amber-600 border-amber-400/40 gap-1"><Pencil className="w-3 h-3" /> Coach Override</Badge>
              )}
            </h3>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{workout.date}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[workout.status]}`}>{workout.status.replace('_', ' ')}</span>
      </div>

      {workout.exercises?.length > 0 && (
        <div className="mt-4 divide-y divide-border">
          {workout.exercises.map((ex, i) => (
            <div key={i} className="py-2.5 flex items-start gap-3">
              <Dumbbell className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{ex.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ex.sets ? `${ex.sets} sets · ` : ''}{ex.reps ? `${ex.reps} reps` : ''}{ex.load ? ` · ${ex.load}` : ''}
                </p>
                {ex.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{ex.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Coach notes…" rows={2}
          className="w-full mt-3 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
      )}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Button size="sm" variant="outline" onClick={cycleStatus}>
          <Check className="w-4 h-4 mr-1.5" /> Mark {workout.status === 'planned' ? 'In Progress' : workout.status === 'in_progress' ? 'Complete' : 'Planned'}
        </Button>
        <Button size="sm" variant="outline" onClick={toggleOverride}>
          <Lock className="w-4 h-4 mr-1.5" /> {workout.coach_override ? 'Release Override' : 'Coach Override'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Cancel' : 'Edit'}
        </Button>
        <Button size="sm" variant="ghost" onClick={saveAsTemplate} disabled={saving}>
          <Bookmark className="w-4 h-4 mr-1.5" /> {templated ? 'Saved' : 'Save as Template'}
        </Button>
        {editing && <Button size="sm" onClick={saveEdit} disabled={saving} className="ml-auto">{saving ? 'Saving…' : 'Save'}</Button>}
      </div>
    </Card>
  );
}