import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Copy, Trash2, Calendar, Loader2, Sparkles, Dumbbell, FolderOpen, Layers } from 'lucide-react';
import {
  createBlankWorkout, createBlankBlock, relabelBlocks, normalizeWorkout, FOCUS_OPTIONS, BLOCK_LABELS
} from '@/lib/workoutUtils';
import BlockEditor from '@/components/planner/BlockEditor';
import ExercisePicker from '@/components/planner/ExercisePicker';
import AIPanel from '@/components/planner/AIPanel';
import ScheduleDialog from '@/components/planner/ScheduleDialog';

export default function WorkoutPlanner() {
  const { user, loading: userLoading } = useCurrentUser();
  const { activeId, isCoach } = useActiveAthlete(user);
  const [workouts, setWorkouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [teams, setTeams] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [expandedPrograms, setExpandedPrograms] = useState({});

  const loadAll = useCallback(async () => {
    if (!activeId) return;
    setLoadingData(true);
    try {
      const [wkRes, tplRes, progRes, exRes, teamRes, asgRes] = await Promise.all([
        base44.entities.Workout.filter({ user_id: activeId }, { sort: '-updated_date', limit: 100 }),
        base44.entities.WorkoutTemplate.filter({}, { sort: '-updated_date', limit: 50 }),
        base44.entities.Program.filter({}, { sort: '-created_date', limit: 50 }),
        base44.entities.Exercise.filter({}, { limit: 200 }),
        base44.entities.Team.filter({ coach_id: user.id }, { limit: 50 }),
        base44.entities.WorkoutAssignment.filter({}, { sort: '-created_date', limit: 50 }),
      ]);
      setWorkouts((wkRes.items || []).map(normalizeWorkout));
      setTemplates(tplRes.items || []);
      setPrograms(progRes.items || []);
      setExercises(exRes.items || []);
      setTeams(teamRes.items || []);
      setAssignments(asgRes.items || []);
    } finally { setLoadingData(false); }
  }, [activeId, user?.id]);

  useEffect(() => { if (user) loadAll(); }, [user, activeId]);

  const programWorkouts = workouts.filter((w) => w.program_id);
  const standaloneWorkouts = workouts.filter((w) => !w.program_id);

  const newWorkout = async () => {
    const w = createBlankWorkout();
    w.user_id = activeId;
    w.created_by_id = user.id;
    const created = await base44.entities.Workout.create(w);
    const normalized = normalizeWorkout(created);
    setWorkouts((prev) => [normalized, ...prev]);
    setSelected(normalized);
  };

  const duplicateWorkout = async (wk) => {
    const copy = { ...wk, title: wk.title + ' (Copy)', id: undefined, created_date: undefined, updated_date: undefined };
    const created = await base44.entities.Workout.create(copy);
    const normalized = normalizeWorkout(created);
    setWorkouts((prev) => [normalized, ...prev]);
    setSelected(normalized);
  };

  const deleteWorkout = async (wk) => {
    await base44.entities.Workout.delete(wk.id);
    setWorkouts((prev) => prev.filter((w) => w.id !== wk.id));
    if (selected?.id === wk.id) setSelected(null);
  };

  const updateSelected = (patch) => {
    setSelected((prev) => prev ? { ...prev, ...patch } : prev);
  };

  const updateBlock = (blockIdx, newBlock) => {
    const blocks = [...(selected.blocks || [])];
    blocks[blockIdx] = newBlock;
    const relabeled = relabelBlocks(blocks);
    updateSelected({ blocks: relabeled });
  };

  const addBlock = () => {
    const blocks = [...(selected.blocks || []), createBlankBlock(selected.blocks?.length || 0)];
    const relabeled = relabelBlocks(blocks);
    updateSelected({ blocks: relabeled });
  };

  const removeBlock = (blockIdx) => {
    const blocks = (selected.blocks || []).filter((_, i) => i !== blockIdx);
    const relabeled = relabelBlocks(blocks);
    updateSelected({ blocks: relabeled });
  };

  const moveBlock = (blockIdx, dir) => {
    const blocks = [...(selected.blocks || [])];
    const target = blockIdx + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[blockIdx], blocks[target]] = [blocks[target], blocks[blockIdx]];
    updateSelected({ blocks: relabelBlocks(blocks) });
  };

  const saveWorkout = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { id, ...patch } = selected;
      const updated = await base44.entities.Workout.update(id, patch);
      const normalized = normalizeWorkout(updated);
      setSelected(normalized);
      setWorkouts((prev) => prev.map((w) => w.id === id ? normalized : w));
    } finally { setSaving(false); }
  };

  const handleGenerateWorkout = async ({ prompt, sport, goal }) => {
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('generateProgram', { mode: 'workout', prompt, sport, goal });
      const wk = res.data.workout;
      wk.user_id = activeId;
      wk.ai_generated = true;
      wk.status = 'planned';
      wk.focus = wk.focus || 'mixed';
      wk.blocks = (wk.blocks || []).map((b, i) => ({ ...b, id: `b${Date.now()}${i}`, label: BLOCK_LABELS[i] || `B${i+1}` }));
      const created = await base44.entities.Workout.create(wk);
      const normalized = normalizeWorkout(created);
      setWorkouts((prev) => [normalized, ...prev]);
      setSelected(normalized);
    } finally { setAiLoading(false); }
  };

  const handleGenerateProgram = async ({ prompt, weeks, sessions_per_week, sport, goal }) => {
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('generateProgram', { mode: 'program', prompt, weeks, sessions_per_week, sport, goal });
      const prog = res.data.program;
      prog.created_by_id = user.id;
      const createdProg = await base44.entities.Program.create({
        name: prog.name, description: prog.description, num_weeks: prog.num_weeks, sport, goal
      });
      const wkRecords = (prog.workouts || []).map((w) => ({
        user_id: activeId,
        title: w.title,
        focus: w.focus || 'mixed',
        estimated_duration: w.estimated_duration,
        blocks: (w.blocks || []).map((b, i) => ({ ...b, id: `b${Date.now()}${i}`, label: BLOCK_LABELS[i] || `B${i+1}` })),
        program_id: createdProg.id,
        week_number: w.week_number,
        day_number: w.day_number,
        status: 'planned',
        ai_generated: true,
      }));
      const created = await base44.entities.Workout.bulkCreate(wkRecords);
      const newWorkouts = (created.records || created || []).map(normalizeWorkout);
      setPrograms((prev) => [createdProg, ...prev]);
      setWorkouts((prev) => [...newWorkouts, ...prev]);
      setExpandedPrograms((prev) => ({ ...prev, [createdProg.id]: true }));
    } finally { setAiLoading(false); }
  };

  const handleModifyWorkout = async (preset) => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('modifyWorkout', { workout: selected, preset });
      const wk = res.data.workout;
      const blocks = (wk.blocks || []).map((b, i) => ({ ...b, id: `b${Date.now()}${i}`, label: BLOCK_LABELS[i] || `B${i+1}` }));
      updateSelected({ title: wk.title, focus: wk.focus, estimated_duration: wk.estimated_duration, blocks, ai_generated: true });
    } finally { setAiLoading(false); }
  };

  const assignmentCount = (workoutId) => assignments.filter((a) => a.workout_id === workoutId).length;

  if (userLoading || (!user && !activeId)) {
    return <div className="h-64 flex items-center justify-center text-muted-foreground">{userLoading ? 'Loading…' : 'No active athlete.'}</div>;
  }

  return (
    <div>
      <PageHeader title="Workout Planner" subtitle="Design, edit, schedule and AI-generate training sessions and programs"
        actions={<Button onClick={newWorkout} size="sm"><Plus className="w-4 h-4 mr-1" /> New Workout</Button>} />

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        {/* Left pane: list */}
        <div className="space-y-4">
          {programs.length > 0 && (
            <div>
              <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><FolderOpen className="w-3 h-3" /> Programs</p>
              <div className="space-y-1">
                {programs.map((prog) => (
                  <div key={prog.id}>
                    <button onClick={() => setExpandedPrograms((p) => ({ ...p, [prog.id]: !p[prog.id] }))}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium hover:bg-accent transition">
                      <span className="truncate">{prog.name}</span>
                      <span className="text-[10px] text-muted-foreground">{prog.num_weeks}w</span>
                    </button>
                    {expandedPrograms[prog.id] && programWorkouts.filter((w) => w.program_id === prog.id).map((w) => (
                      <WorkoutListItem key={w.id} workout={w} selected={selected} onSelect={setSelected} onDuplicate={duplicateWorkout} onDelete={deleteWorkout} assignmentCount={assignmentCount(w.id)} indent />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Dumbbell className="w-3 h-3" /> Workouts</p>
            <div className="space-y-1">
              {standaloneWorkouts.map((w) => (
                <WorkoutListItem key={w.id} workout={w} selected={selected} onSelect={setSelected} onDuplicate={duplicateWorkout} onDelete={deleteWorkout} assignmentCount={assignmentCount(w.id)} />
              ))}
              {standaloneWorkouts.length === 0 && !loadingData && <p className="px-2.5 text-xs text-muted-foreground">No workouts yet.</p>}
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Layers className="w-3 h-3" /> Templates</p>
              <div className="space-y-1">
                {templates.map((t) => (
                  <button key={t.id} onClick={() => setSelected(normalizeWorkout(t))}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition ${selected?.id === t.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}>
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right pane: editor */}
        <div className="space-y-4">
          {loadingData ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
          ) : selected ? (
            <>
              <Card className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Label className="text-xs">Title</Label>
                    <Input value={selected.title || ''} onChange={(e) => updateSelected({ title: e.target.value })} className="h-9" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Focus</Label>
                    <Select value={selected.focus || 'mixed'} onValueChange={(v) => updateSelected({ focus: v })}>
                      <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{FOCUS_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Duration (min)</Label>
                    <Input type="number" value={selected.estimated_duration || ''} onChange={(e) => updateSelected({ estimated_duration: Number(e.target.value) || null })} className="w-24 h-9" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={saveWorkout} disabled={saving} size="sm">{saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}Save</Button>
                  <Button onClick={() => duplicateWorkout(selected)} variant="outline" size="sm"><Copy className="w-3.5 h-3.5 mr-1" />Duplicate</Button>
                  <Button onClick={() => setScheduleOpen(true)} variant="outline" size="sm"><Calendar className="w-3.5 h-3.5 mr-1" />Schedule</Button>
                  <Button onClick={() => deleteWorkout(selected)} variant="outline" size="sm" className="text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>
                  {selected.ai_generated && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary"><Sparkles className="w-2.5 h-2.5" /> AI-generated</span>}
                  {assignmentCount(selected.id) > 0 && <span className="text-[10px] text-muted-foreground">{assignmentCount(selected.id)} assignment(s)</span>}
                </div>
              </Card>

              <div className="space-y-3">
                {(selected.blocks || []).map((blk, bi) => (
                  <BlockEditor key={blk.id || bi} block={blk} blockIdx={bi} exerciseLibrary={exercises}
                    onUpdate={(nb) => updateBlock(bi, nb)} onRemove={() => removeBlock(bi)}
                    onMoveUp={() => moveBlock(bi, -1)} onMoveDown={() => moveBlock(bi, 1)}
                    canMoveUp={bi > 0} canMoveDown={bi < (selected.blocks?.length || 0) - 1} />
                ))}
                <button onClick={addBlock} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition">
                  <Plus className="w-4 h-4" /> Add Block
                </button>
              </div>

              <AIPanel hasWorkout={true} loading={aiLoading}
                onGenerateWorkout={handleGenerateWorkout} onGenerateProgram={handleGenerateProgram} onModifyWorkout={handleModifyWorkout} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Dumbbell className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Select a workout or create a new one to start building.</p>
              <Button onClick={newWorkout} className="mt-4" size="sm"><Plus className="w-4 h-4 mr-1" /> New Workout</Button>
            </div>
          )}
        </div>
      </div>

      <ExercisePicker open={pickerOpen} onOpenChange={setPickerOpen} exerciseLibrary={exercises} onPick={() => {}} />
      <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} workout={selected} teams={teams} athletes={athletes} />
    </div>
  );
}

function WorkoutListItem({ workout, selected, onSelect, onDuplicate, onDelete, assignmentCount, indent }) {
  const isActive = selected?.id === workout.id;
  return (
    <div className={`group flex items-center gap-1 rounded-lg transition ${isActive ? 'bg-primary/10' : 'hover:bg-accent'} ${indent ? 'ml-3' : ''}`}>
      <button onClick={() => onSelect(workout)} className="flex-1 text-left px-2.5 py-2 min-w-0">
        <p className={`text-sm truncate ${isActive ? 'text-primary font-medium' : ''}`}>{workout.title}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {workout.focus && <span className="capitalize">{workout.focus.replace('_', ' ')}</span>}
          {workout.blocks?.length > 0 && <span>{workout.blocks.length} blocks</span>}
          {assignmentCount > 0 && <span>· {assignmentCount} scheduled</span>}
        </div>
      </button>
      <div className="flex items-center pr-1 opacity-0 group-hover:opacity-100 transition">
        <button onClick={(e) => { e.stopPropagation(); onDuplicate(workout); }} className="p-1 rounded hover:bg-background"><Copy className="w-3 h-3" /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(workout); }} className="p-1 rounded hover:bg-background hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
  );
}