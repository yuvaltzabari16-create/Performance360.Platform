import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { errorMessage } from '@/lib/athleteData';
import { useConnectedAthletes } from '@/components/AthleteSelector';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Copy, Trash2, Calendar, Loader2, Sparkles, Dumbbell, FolderOpen, Layers, Lock, Bookmark } from 'lucide-react';
import {
  createBlankWorkout, createBlankBlock, relabelBlocks, normalizeWorkout, FOCUS_OPTIONS, BLOCK_LABELS,
} from '@/lib/workoutUtils';
import BlockEditor from '@/components/planner/BlockEditor';
import AIPanel from '@/components/planner/AIPanel';
import ScheduleDialog from '@/components/planner/ScheduleDialog';

const FOCUS_VALUES = FOCUS_OPTIONS.map((f) => f.value);
const withBlockIds = (blocks) => (blocks || []).map((b, i) => ({ ...b, id: `b${Date.now()}${i}`, label: BLOCK_LABELS[i] || `B${i + 1}` }));

/** Editable workout content only — never ownership, status or results. */
function contentOf(w) {
  return {
    title: w.title || w.name || 'Untitled workout',
    focus: FOCUS_VALUES.includes(w.focus) ? w.focus : 'mixed',
    estimated_duration: w.estimated_duration || undefined,
    blocks: relabelBlocks(w.blocks || []),
    notes: w.notes,
  };
}

export default function WorkoutPlanner() {
  const { user, loading: userLoading } = useCurrentUser();
  const isCoach = user?.role === 'coach' || user?.role === 'admin';
  const { athletes: links } = useConnectedAthletes(isCoach ? user?.id : null);
  const [workouts, setWorkouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [teams, setTeams] = useState([]);
  const [scheduledCounts, setScheduledCounts] = useState({});
  const [selected, setSelected] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedPrograms, setExpandedPrograms] = useState({});

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoadingData(true); setError('');
    try {
      const [wkRes, tplRes, progRes, exRes, teamRes, asgRes] = await Promise.all([
        base44.entities.Workout.filter({ user_id: user.id }, { sort: '-updated_date', limit: 200 }),
        base44.entities.WorkoutTemplate.filter({}, { sort: '-updated_date', limit: 100 }),
        base44.entities.Program.filter({}, { sort: '-created_date', limit: 50 }),
        base44.entities.Exercise.filter({}, { limit: 500 }),
        isCoach ? base44.entities.Team.filter({ coach_id: user.id }, { limit: 100 }) : Promise.resolve({ items: [] }),
        isCoach ? base44.entities.WorkoutAssignment.filter({ coach_id: user.id }, { sort: '-created_date', limit: 500 }) : Promise.resolve({ items: [] }),
      ]);
      setWorkouts((wkRes.items || []).map(normalizeWorkout));
      setTemplates(tplRes.items || []);
      setPrograms(progRes.items || []);
      setExercises(exRes.items || []);
      setTeams(teamRes.items || []);
      const counts = {};
      for (const a of asgRes.items || []) {
        const k = a.source_workout_id || a.workout_id;
        counts[k] = (counts[k] || 0) + 1;
      }
      setScheduledCounts(counts);
    } catch (e) { setError(errorMessage(e, 'Could not load your workouts')); }
    finally { setLoadingData(false); }
  }, [user?.id, isCoach]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const isTemplate = selected?._kind === 'template';
  // Coach-assigned and completed sessions are history/prescriptions the user cannot rewrite here.
  const readOnly = !!selected && !isTemplate && (
    selected.owner_scope === 'assigned' || selected.status === 'completed' || selected.status === 'skipped'
  );
  const readOnlyReason = !selected ? '' : selected.status === 'completed' || selected.status === 'skipped'
    ? 'This session has been recorded. Its prescription is locked so history stays accurate — duplicate it to plan a new one.'
    : selected.owner_scope === 'assigned' ? 'This session was prescribed by your coach. Log your results from the Dashboard.' : '';

  const select = (w) => { setSelected(w); setDirty(false); setNotice(''); setError(''); };
  const programWorkouts = workouts.filter((w) => w.program_id);
  const standaloneWorkouts = workouts.filter((w) => !w.program_id);

  const createWorkout = async (content, extra = {}) => {
    const created = await base44.entities.Workout.create({
      ...content,
      ...extra,
      user_id: user.id,
      owner_scope: isCoach ? 'coach_library' : 'personal',
      status: 'planned',
    });
    const n = normalizeWorkout(created);
    setWorkouts((prev) => [n, ...prev]);
    return n;
  };

  const guard = async (fn, fallback) => {
    setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(errorMessage(e, fallback)); }
  };

  const newWorkout = () => guard(async () => select(await createWorkout(contentOf(createBlankWorkout()))), 'Could not create a workout');
  const duplicateWorkout = (wk) => guard(async () => {
    const c = contentOf(wk);
    select(await createWorkout({ ...c, title: c.title + ' (copy)' }));
  }, 'Could not duplicate');

  const deleteWorkout = (wk) => guard(async () => {
    if (wk._kind === 'template') {
      await base44.entities.WorkoutTemplate.delete(wk.id);
      setTemplates((prev) => prev.filter((t) => t.id !== wk.id));
    } else {
      await base44.entities.Workout.delete(wk.id);
      setWorkouts((prev) => prev.filter((w) => w.id !== wk.id));
    }
    if (selected?.id === wk.id) select(null);
  }, 'Could not delete');

  const updateSelected = (patch) => { setSelected((prev) => (prev ? { ...prev, ...patch } : prev)); setDirty(true); };
  const setBlocks = (blocks) => updateSelected({ blocks: relabelBlocks(blocks) });
  const updateBlock = (i, nb) => setBlocks((selected.blocks || []).map((b, j) => (j === i ? nb : b)));
  const addBlock = () => setBlocks([...(selected.blocks || []), createBlankBlock(selected.blocks?.length || 0)]);
  const removeBlock = (i) => setBlocks((selected.blocks || []).filter((_, j) => j !== i));
  const moveBlock = (i, dir) => {
    const blocks = [...(selected.blocks || [])];
    const t = i + dir;
    if (t < 0 || t >= blocks.length) return;
    [blocks[i], blocks[t]] = [blocks[t], blocks[i]];
    setBlocks(blocks);
  };

  const save = () => guard(async () => {
    if (!selected || readOnly) return;
    setSaving(true);
    try {
      const c = contentOf(selected);
      if (isTemplate) {
        const updated = await base44.entities.WorkoutTemplate.update(selected.id, { name: c.title, focus: c.focus, estimated_duration: c.estimated_duration, blocks: c.blocks });
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        select({ ...normalizeWorkout(updated), title: updated.name, _kind: 'template' });
      } else {
        const updated = normalizeWorkout(await base44.entities.Workout.update(selected.id, c));
        setWorkouts((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
        select(updated);
      }
      setNotice('Saved');
    } finally { setSaving(false); }
  }, 'Could not save');

  const saveAsTemplate = () => guard(async () => {
    const c = contentOf(selected);
    const t = await base44.entities.WorkoutTemplate.create({ name: c.title, focus: c.focus, estimated_duration: c.estimated_duration, blocks: c.blocks });
    setTemplates((prev) => [t, ...prev]);
    setNotice('Saved as template');
  }, 'Could not save template');

  const useTemplate = () => guard(async () => select(await createWorkout(contentOf(selected))), 'Could not create a workout from this template');

  const handleGenerateWorkout = ({ prompt, sport, goal }) => guard(async () => {
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('generateProgram', { mode: 'workout', prompt, sport, goal });
      const wk = res.data.workout;
      select(await createWorkout(contentOf({ ...wk, blocks: withBlockIds(wk.blocks) }), { ai_generated: true }));
    } finally { setAiLoading(false); }
  }, 'AI generation failed');

  const handleGenerateProgram = ({ prompt, weeks, sessions_per_week, sport, goal }) => guard(async () => {
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('generateProgram', { mode: 'program', prompt, weeks, sessions_per_week, sport, goal });
      const prog = res.data.program;
      const createdProg = await base44.entities.Program.create({ name: prog.name, description: prog.description, num_weeks: prog.num_weeks, sport, goal });
      const records = (prog.workouts || []).map((w) => ({
        ...contentOf({ ...w, blocks: withBlockIds(w.blocks) }),
        user_id: user.id,
        owner_scope: isCoach ? 'coach_library' : 'personal',
        program_id: createdProg.id,
        week_number: w.week_number,
        day_number: w.day_number,
        status: 'planned',
        ai_generated: true,
      }));
      const created = await base44.entities.Workout.bulkCreate(records);
      const list = (Array.isArray(created) ? created : created?.records || []).map(normalizeWorkout);
      setPrograms((prev) => [createdProg, ...prev]);
      setWorkouts((prev) => [...list, ...prev]);
      setExpandedPrograms((prev) => ({ ...prev, [createdProg.id]: true }));
      setNotice(`Program created with ${list.length} sessions — review before scheduling.`);
    } finally { setAiLoading(false); }
  }, 'AI program generation failed');

  const handleModifyWorkout = (preset) => guard(async () => {
    if (!selected || readOnly) return;
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('modifyWorkout', { workout: contentOf(selected), preset });
      const wk = res.data.workout;
      updateSelected({ ...contentOf({ ...wk, blocks: withBlockIds(wk.blocks) }), ai_generated: true });
      setNotice('AI changes applied — review and save.');
    } finally { setAiLoading(false); }
  }, 'AI modification failed');

  if (userLoading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  const athletesForSchedule = links.map((a) => ({ id: a.athlete_id, full_name: a.athlete_name, email: a.athlete_email }));

  return (
    <div>
      <PageHeader title="Workout Planner"
        subtitle={isCoach ? 'Build sessions and programs, then schedule them for connected athletes or teams' : 'Your sessions, including those prescribed by your coach'}
        actions={<Button onClick={newWorkout} size="sm"><Plus className="w-4 h-4 mr-1" /> New workout</Button>} />

      {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        <nav aria-label="Workouts" className="space-y-4 min-w-0">
          {programs.length > 0 && (
            <div>
              <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><FolderOpen className="w-3 h-3" aria-hidden /> Programs</p>
              <div className="space-y-1">
                {programs.map((prog) => (
                  <div key={prog.id}>
                    <button onClick={() => setExpandedPrograms((p) => ({ ...p, [prog.id]: !p[prog.id] }))} aria-expanded={!!expandedPrograms[prog.id]}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium hover:bg-accent transition">
                      <span className="truncate">{prog.name}</span>
                      <span className="text-[10px] text-muted-foreground">{prog.num_weeks}w</span>
                    </button>
                    {expandedPrograms[prog.id] && programWorkouts.filter((w) => w.program_id === prog.id).map((w) => (
                      <WorkoutListItem key={w.id} workout={w} selected={selected} onSelect={select} onDuplicate={duplicateWorkout} onDelete={setConfirmDelete} count={scheduledCounts[w.id]} indent />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Dumbbell className="w-3 h-3" aria-hidden /> Workouts</p>
            <div className="space-y-1">
              {loadingData ? <p className="px-2.5 text-xs text-muted-foreground">Loading…</p>
                : standaloneWorkouts.length === 0 ? <p className="px-2.5 text-xs text-muted-foreground">No workouts yet.</p>
                : standaloneWorkouts.map((w) => (
                  <WorkoutListItem key={w.id} workout={w} selected={selected} onSelect={select} onDuplicate={duplicateWorkout} onDelete={setConfirmDelete} count={scheduledCounts[w.id]} />
                ))}
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Layers className="w-3 h-3" aria-hidden /> Templates</p>
              <div className="space-y-1">
                {templates.map((t) => (
                  <button key={t.id} onClick={() => select({ ...normalizeWorkout(t), title: t.name, _kind: 'template' })}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition ${selected?.id === t.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}>
                    <span className="truncate block">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="space-y-4 min-w-0">
          {selected ? (
            <>
              <Card className="p-4">
                {isTemplate && <p className="mb-3 text-xs font-medium text-primary flex items-center gap-1"><Layers className="w-3.5 h-3.5" aria-hidden /> Template</p>}
                {readOnly && <p className="mb-3 flex gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"><Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />{readOnlyReason}</p>}
                <fieldset disabled={readOnly} className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Label htmlFor="wk-title" className="text-xs">Title</Label>
                    <Input id="wk-title" maxLength={120} value={selected.title || ''} onChange={(e) => updateSelected({ title: e.target.value })} className="h-9" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Focus</Label>
                    <Select value={selected.focus || 'mixed'} onValueChange={(v) => updateSelected({ focus: v })} disabled={readOnly}>
                      <SelectTrigger className="w-40 h-9" aria-label="Focus"><SelectValue /></SelectTrigger>
                      <SelectContent>{FOCUS_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wk-dur" className="text-xs">Duration (min)</Label>
                    <Input id="wk-dur" type="number" min={1} max={600} value={selected.estimated_duration || ''} onChange={(e) => updateSelected({ estimated_duration: Number(e.target.value) || undefined })} className="w-24 h-9" />
                  </div>
                </fieldset>
                <div className="flex flex-wrap items-center gap-2">
                  {!readOnly && <Button onClick={save} disabled={saving || !dirty} size="sm">{saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}{dirty ? 'Save' : 'Saved'}</Button>}
                  {isTemplate ? (
                    <Button onClick={useTemplate} variant="outline" size="sm"><Plus className="w-3.5 h-3.5 mr-1" />New workout from template</Button>
                  ) : (
                    <>
                      <Button onClick={() => duplicateWorkout(selected)} variant="outline" size="sm"><Copy className="w-3.5 h-3.5 mr-1" />Duplicate</Button>
                      <Button onClick={saveAsTemplate} variant="outline" size="sm"><Bookmark className="w-3.5 h-3.5 mr-1" />Save as template</Button>
                      {isCoach && selected.owner_scope !== 'assigned' && (
                        <Button onClick={() => setScheduleOpen(true)} variant="outline" size="sm" disabled={dirty} title={dirty ? 'Save first' : undefined}><Calendar className="w-3.5 h-3.5 mr-1" />Schedule</Button>
                      )}
                    </>
                  )}
                  {(!readOnly || isTemplate) && selected.owner_scope !== 'assigned' && (
                    <Button onClick={() => setConfirmDelete(selected)} variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>
                  )}
                  {selected.ai_generated && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary"><Sparkles className="w-2.5 h-2.5" aria-hidden /> AI draft — review before use</span>}
                  {scheduledCounts[selected.id] > 0 && <span className="text-[10px] text-muted-foreground">Scheduled {scheduledCounts[selected.id]}×</span>}
                  {notice && <span role="status" className="text-xs text-emerald-500">{notice}</span>}
                </div>
              </Card>

              <fieldset disabled={readOnly} className="space-y-3 min-w-0">
                {(selected.blocks || []).map((blk, bi) => (
                  <BlockEditor key={blk.id || bi} block={blk} blockIdx={bi} exerciseLibrary={exercises}
                    onUpdate={(nb) => updateBlock(bi, nb)} onRemove={() => removeBlock(bi)}
                    onMoveUp={() => moveBlock(bi, -1)} onMoveDown={() => moveBlock(bi, 1)}
                    canMoveUp={bi > 0} canMoveDown={bi < (selected.blocks?.length || 0) - 1} />
                ))}
                {!readOnly && (
                  <button onClick={addBlock} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition">
                    <Plus className="w-4 h-4" aria-hidden /> Add block
                  </button>
                )}
              </fieldset>

              {!readOnly && !isTemplate && (
                <AIPanel hasWorkout loading={aiLoading} onGenerateWorkout={handleGenerateWorkout} onGenerateProgram={handleGenerateProgram} onModifyWorkout={handleModifyWorkout} />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Dumbbell className="w-10 h-10 text-muted-foreground/30 mb-3" aria-hidden />
              <p className="text-sm text-muted-foreground">Select a workout or create one.</p>
              <div className="mt-4 w-full max-w-xl text-left">
                <AIPanel hasWorkout={false} loading={aiLoading} onGenerateWorkout={handleGenerateWorkout} onGenerateProgram={handleGenerateProgram} onModifyWorkout={() => {}} />
              </div>
            </div>
          )}
        </div>
      </div>

      {isCoach && (
        <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} workout={selected} teams={teams} athletes={athletesForSchedule}
          onScheduled={(msg) => { setNotice(msg); loadAll(); }} />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDelete?.title || confirmDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from your planner. Sessions already scheduled for athletes are separate copies and are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const w = confirmDelete; setConfirmDelete(null); deleteWorkout(w); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WorkoutListItem({ workout, selected, onSelect, onDuplicate, onDelete, count, indent }) {
  const isActive = selected?.id === workout.id;
  const locked = workout.owner_scope === 'assigned' || workout.status === 'completed' || workout.status === 'skipped';
  return (
    <div className={`group flex items-center gap-1 rounded-lg transition ${isActive ? 'bg-primary/10' : 'hover:bg-accent'} ${indent ? 'ml-3' : ''}`}>
      <button onClick={() => onSelect(workout)} className="flex-1 text-left px-2.5 py-2 min-w-0">
        <p className={`text-sm truncate ${isActive ? 'text-primary font-medium' : ''}`}>{workout.title}</p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {workout.date && <span>{workout.date}</span>}
          {workout.focus && <span className="capitalize">{workout.focus.replace('_', ' ')}</span>}
          {workout.status && workout.status !== 'planned' && <span className="capitalize">{workout.status}</span>}
          {workout.owner_scope === 'assigned' && <span>from coach</span>}
          {count > 0 && <span>· scheduled {count}×</span>}
        </div>
      </button>
      <div className="flex items-center pr-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition">
        <button aria-label={`Duplicate ${workout.title}`} onClick={(e) => { e.stopPropagation(); onDuplicate(workout); }} className="p-1 rounded hover:bg-background"><Copy className="w-3 h-3" /></button>
        {!locked && <button aria-label={`Delete ${workout.title}`} onClick={(e) => { e.stopPropagation(); onDelete(workout); }} className="p-1 rounded hover:bg-background hover:text-destructive"><Trash2 className="w-3 h-3" /></button>}
      </div>
    </div>
  );
}
