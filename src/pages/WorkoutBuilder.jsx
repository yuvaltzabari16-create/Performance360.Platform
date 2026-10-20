import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, todayStr } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader from '@/components/PageHeader';
import AthleteSelector from '@/components/AthleteSelector';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, BookmarkPlus, Search, Dumbbell, Library, RotateCcw } from 'lucide-react';

const CATEGORIES = ['all', 'strength', 'power', 'speed', 'mobility', 'conditioning', 'plyometrics', 'core', 'rehab'];
const emptyExercise = { name: '', sets: 3, reps: '8-12', load: '', notes: '' };

export default function WorkoutBuilder() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr());
  const [exercises, setExercises] = useState([{ ...emptyExercise }]);
  const [saving, setSaving] = useState(false);
  const [tplSaving, setTplSaving] = useState(false);

  // library
  const [library, setLibrary] = useState([]);
  const [libQuery, setLibQuery] = useState('');
  const [libCat, setLibCat] = useState('all');

  // templates
  const [templates, setTemplates] = useState([]);

  const loadLibrary = async () => {
    const res = await base44.entities.Exercise.filter({}, { sort: 'name', limit: 300 });
    setLibrary(res.items || []);
  };
  const loadTemplates = async () => {
    const res = await base44.entities.WorkoutTemplate.filter({}, { sort: '-created_date', limit: 100 });
    setTemplates(res.items || []);
  };
  useEffect(() => { loadLibrary(); loadTemplates(); }, []);

  const filteredLib = library.filter((e) =>
    (libCat === 'all' || e.category === libCat) &&
    (!libQuery || e.name?.toLowerCase().includes(libQuery.toLowerCase()))
  );

  const addRow = () => setExercises((e) => [...e, { ...emptyExercise }]);
  const removeRow = (i) => setExercises((e) => e.filter((_, idx) => idx !== i));
  const update = (i, field, val) => setExercises((e) => e.map((ex, idx) => idx === i ? { ...ex, [field]: val } : ex));
  const addFromLibrary = (ex) => setExercises((e) => [...e, { name: ex.name, sets: 3, reps: '8-12', load: '', notes: ex.instructions || '' }]);

  const save = async () => {
    if (!title.trim() || !activeId) return;
    setSaving(true);
    try {
      await base44.entities.Workout.create({
        user_id: activeId, date, title: title.trim(),
        exercises: exercises.filter((e) => e.name.trim()), status: 'planned',
      });
      setTitle(''); setExercises([{ ...emptyExercise }]);
    } finally { setSaving(false); }
  };

  const saveTemplate = async () => {
    if (!title.trim()) return;
    setTplSaving(true);
    try {
      await base44.entities.WorkoutTemplate.create({
        name: title.trim(),
        category: 'custom',
        exercises: exercises.filter((e) => e.name.trim()),
      });
      loadTemplates();
    } finally { setTplSaving(false); }
  };

  const applyTemplate = (t) => {
    setTitle(t.name);
    setExercises(t.exercises?.length ? t.exercises.map((e) => ({ sets: 3, reps: '', load: '', notes: '', ...e })) : [{ ...emptyExercise }]);
  };
  const deleteTemplate = async (id) => { await base44.entities.WorkoutTemplate.delete(id); loadTemplates(); };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="Workout Builder" subtitle="Design custom sessions, pull from the exercise library, and save reusable templates"
        actions={isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />} />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Builder */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <div className="flex flex-col gap-1.5"><Label className="text-xs">Session title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lower Body Power" /></div>
              <div className="flex flex-col gap-1.5"><Label className="text-xs">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <div className="col-span-4">Exercise</div><div className="col-span-1">Sets</div>
                <div className="col-span-2">Reps</div><div className="col-span-2">Load</div>
                <div className="col-span-2">Notes</div><div className="col-span-1"></div>
              </div>
              {exercises.map((ex, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-4" placeholder="Exercise" value={ex.name} onChange={(e) => update(i, 'name', e.target.value)} />
                  <Input className="col-span-1" type="number" value={ex.sets} onChange={(e) => update(i, 'sets', Number(e.target.value))} />
                  <Input className="col-span-2" value={ex.reps} onChange={(e) => update(i, 'reps', e.target.value)} />
                  <Input className="col-span-2" value={ex.load} onChange={(e) => update(i, 'load', e.target.value)} placeholder="80kg" />
                  <Input className="col-span-2" value={ex.notes} onChange={(e) => update(i, 'notes', e.target.value)} />
                  <button onClick={() => removeRow(i)} className="col-span-1 text-muted-foreground hover:text-destructive flex justify-center"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" onClick={addRow}><Plus className="w-4 h-4 mr-1.5" /> Add row</Button>
              <Button onClick={save} disabled={saving || !title.trim() || !activeId}>
                <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : 'Save Workout'}
              </Button>
              <Button variant="secondary" onClick={saveTemplate} disabled={tplSaving || !title.trim()}>
                <BookmarkPlus className="w-4 h-4 mr-1.5" /> {tplSaving ? 'Saving…' : 'Save as Template'}
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Dumbbell className="w-4 h-4" />
              Saved workouts appear on the Dashboard and weekly calendar.
            </div>
          </Card>
        </div>

        {/* Library + Templates */}
        <div className="space-y-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3"><Library className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">Exercise Library</h3></div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-sm" placeholder="Search…" value={libQuery} onChange={(e) => setLibQuery(e.target.value)} />
            </div>
            <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1 mb-2">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setLibCat(c)}
                  className={`px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap capitalize ${libCat === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-1">
              {filteredLib.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No exercises.</p>
              ) : filteredLib.map((ex) => (
                <button key={ex.id} onClick={() => addFromLibrary(ex)} className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-accent transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ex.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{ex.category} · {ex.muscle_group || '—'}</p>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3">Saved Templates</h3>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No templates yet. Save one above.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">{t.exercises?.length || 0} exercises</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => applyTemplate(t)} className="p-1.5 rounded hover:bg-accent text-muted-foreground" title="Load"><RotateCcw className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}