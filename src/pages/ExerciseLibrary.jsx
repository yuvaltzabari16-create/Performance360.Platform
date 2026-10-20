import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Dumbbell } from 'lucide-react';
import ExerciseDetail from '@/components/library/ExerciseDetail';
import ExerciseForm from '@/components/library/ExerciseForm';
import AddToWorkoutDialog from '@/components/library/AddToWorkoutDialog';

const CATEGORIES = ['all', 'strength', 'power', 'speed', 'mobility', 'conditioning', 'plyometrics', 'core', 'rehab', 'return_to_play'];

export default function ExerciseLibrary() {
  const { user } = useCurrentUser();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [addToOpen, setAddToOpen] = useState(false);

  const isCoach = user?.role === 'coach' || user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    const res = await base44.entities.Exercise.filter({}, { sort: 'name', limit: 200 });
    setExercises(res.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = exercises.filter((e) =>
    (category === 'all' || e.category === category) &&
    (!query || e.name?.toLowerCase().includes(query.toLowerCase()) || e.muscle_group?.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSave = async (payload) => {
    if (editing) {
      await base44.entities.Exercise.update(editing.id, payload);
      const updated = await base44.entities.Exercise.get(editing.id);
      setExercises((prev) => prev.map((e) => e.id === updated.id ? updated : e));
      setSelected(updated);
    } else {
      const created = await base44.entities.Exercise.create(payload);
      setExercises((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(created);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const openEdit = (ex) => {
    setEditing(ex);
    setFormOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader title="Exercise Library" subtitle="Football-specific exercises with coaching cues, progressions and video"
        actions={isCoach && <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Exercise</Button>} />

      {formOpen && (
        <div className="mb-6">
          <ExerciseForm initial={editing} onSave={handleSave} onCancel={() => { setFormOpen(false); setEditing(null); }} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search exercises…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap capitalize ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
              {c === 'all' ? 'All' : c.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
        {/* List */}
        <div className="space-y-1.5 lg:max-h-[70vh] lg:overflow-y-auto scrollbar-thin lg:pr-2">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Loading exercises…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No exercises found.
            </div>
          ) : (
            filtered.map((ex) => (
              <button key={ex.id} onClick={() => setSelected(ex)}
                className={`w-full text-left p-3 rounded-lg border transition ${selected?.id === ex.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{ex.name}</h3>
                  <Badge variant="secondary" className="capitalize text-[10px]">{ex.category?.replace('_', ' ')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{ex.muscle_group || '—'} · {ex.equipment || 'No equipment'} · {ex.difficulty}</p>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="lg:max-h-[70vh] lg:overflow-y-auto scrollbar-thin">
          <ExerciseDetail
            exercise={selected}
            onAddToWorkout={() => setAddToOpen(true)}
            onEdit={() => openEdit(selected)}
            canEdit={isCoach}
          />
        </div>
      </div>

      <AddToWorkoutDialog open={addToOpen} onOpenChange={setAddToOpen} exercise={selected} />
    </div>
  );
}