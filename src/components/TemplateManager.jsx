import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, FileDown, Dumbbell, X } from 'lucide-react';

export default function TemplateManager({ coachId, athleteId, onApplied }) {
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [exercises, setExercises] = useState([{ name: '', sets: 3, reps: '8-10', load: '', notes: '' }]);
  const [saving, setSaving] = useState(false);
  const [applyingId, setApplyingId] = useState(null);

  const load = async () => {
    if (!coachId) return;
    const res = await base44.entities.WorkoutTemplate.filter({}, { sort: '-created_date', limit: 100 });
    setTemplates(res.items || []);
  };
  useEffect(() => { load(); }, [coachId]);

  const resetForm = () => {
    setName(''); setCategory(''); setExercises([{ name: '', sets: 3, reps: '8-10', load: '', notes: '' }]);
  };

  const updateEx = (i, field, value) => {
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, [field]: value } : ex)));
  };
  const addEx = () => setExercises((p) => [...p, { name: '', sets: 3, reps: '8-10', load: '', notes: '' }]);
  const removeEx = (i) => setExercises((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await base44.entities.WorkoutTemplate.create({
        name: name.trim(),
        category: category.trim() || undefined,
        exercises: exercises.filter((e) => e.name.trim()),
      });
      resetForm();
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  };

  const apply = async (tpl) => {
    if (!athleteId) return;
    setApplyingId(tpl.id);
    try {
      await base44.entities.Workout.create({
        user_id: athleteId,
        date: new Date().toISOString().slice(0, 10),
        title: tpl.name,
        exercises: tpl.exercises || [],
        status: 'planned',
        coach_override: true,
      });
      onApplied?.();
    } finally { setApplyingId(null); }
  };

  const remove = async (id) => {
    await base44.entities.WorkoutTemplate.delete(id);
    load();
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2"><Dumbbell className="w-4 h-4 text-primary" /> Workout Templates</h2>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1.5" /> New Template
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border p-4 mb-4 space-y-3 bg-secondary/30">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Template name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Speed Development Day" className="mt-1.5" />
            </div>
            <div>
              <Label>Category (optional)</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Speed, Strength, Recovery" className="mt-1.5" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Exercises</Label>
            {exercises.map((ex, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input value={ex.name} onChange={(e) => updateEx(i, 'name', e.target.value)} placeholder="Exercise" className="flex-1 min-w-[140px]" />
                <Input type="number" value={ex.sets} onChange={(e) => updateEx(i, 'sets', Number(e.target.value))} className="w-16" />
                <Input value={ex.reps} onChange={(e) => updateEx(i, 'reps', e.target.value)} placeholder="Reps" className="w-20" />
                <Input value={ex.load} onChange={(e) => updateEx(i, 'load', e.target.value)} placeholder="Load" className="w-24" />
                <Button size="icon" variant="ghost" onClick={() => removeEx(i)}><X className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={addEx}><Plus className="w-4 h-4 mr-1" /> Add exercise</Button>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save Template'}</Button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates yet. Create one to quickly load standard sessions for your athletes.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{tpl.name}</p>
                  {tpl.category && <Badge variant="outline" className="text-xs">{tpl.category}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tpl.exercises?.length || 0} exercise{(tpl.exercises?.length || 0) === 1 ? '' : 's'}
                  {tpl.exercises?.length > 0 && ` · ${tpl.exercises.map((e) => e.name).filter(Boolean).join(', ')}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => apply(tpl)} disabled={!athleteId || applyingId === tpl.id}>
                  <FileDown className="w-4 h-4 mr-1.5" /> {applyingId === tpl.id ? 'Loading…' : 'Load'}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(tpl.id)}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}