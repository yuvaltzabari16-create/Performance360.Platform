import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import { fetchAthleteRecords, errorMessage } from '@/lib/athleteData';
import PageHeader from '@/components/PageHeader';
import AthleteSelector from '@/components/AthleteSelector';
import MilestoneCard from '@/components/MilestoneCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, ShieldCheck, Trash2, Loader2 } from 'lucide-react';

// An editable starting point only. Coaches replace it with the plan agreed
// with the athlete's medical team.
const EXAMPLE_PLAN = [
  { title: 'Protection', description: '', required_tests: [''], exercises: [{ title: '', instructions: '' }] },
];

export default function Rehab() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [milestones, setMilestones] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeId || !user) { setMilestones([]); setBlocks([]); return; }
    setError('');
    try {
      const [m, b] = await Promise.all([
        fetchAthleteRecords(user, activeId, 'ClearanceMilestone', { sort: 'order', limit: 50 }),
        fetchAthleteRecords(user, activeId, 'ExerciseBlock', { sort: 'order', limit: 200 }),
      ]);
      setMilestones(m); setBlocks(b);
    } catch (e) { setError(errorMessage(e)); }
  };
  useEffect(() => { load(); setDraft(null); }, [activeId, user?.id]);

  const canManage = isCoach && activeId && activeId !== user?.id;

  const updatePhase = (i, patch) => setDraft((d) => d.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const savePlan = async () => {
    setSaving(true); setError('');
    try {
      const phases = draft.map((p) => ({
        ...p,
        required_tests: p.required_tests.map((t) => t.trim()).filter(Boolean),
        exercises: p.exercises.filter((e) => e.title.trim()),
      }));
      await base44.functions.invoke('manageRehab', { action: 'create_plan', athlete_id: activeId, phases });
      setDraft(null); load();
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="Return-to-Play" subtitle="Coach-managed rehabilitation phases with recorded professional clearance"
        actions={isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />} />
      <p className="mb-4 text-xs text-muted-foreground">Rehab information is visible only to the athlete and their connected coaches. Phase completion records a decision made by a qualified professional; the app never issues clearance.</p>
      {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {!activeId ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Select a connected athlete.</div>
      ) : milestones.length === 0 && !draft ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" aria-hidden />
          <p className="text-sm text-muted-foreground">No rehab plan.</p>
          {canManage && <Button size="sm" className="mt-4" onClick={() => setDraft(structuredClone(EXAMPLE_PLAN))}><Plus className="w-4 h-4 mr-1.5" /> Create plan</Button>}
        </div>
      ) : draft ? (
        <Card className="p-5 space-y-5">
          <h2 className="font-semibold">New rehab plan</h2>
          {draft.map((p, i) => (
            <fieldset key={i} className="rounded-lg border border-border p-4 space-y-3">
              <legend className="px-1 text-sm font-medium">Phase {i + 1}</legend>
              <Input aria-label={`Phase ${i + 1} title`} placeholder="Phase title" value={p.title} maxLength={120} onChange={(e) => updatePhase(i, { title: e.target.value })} />
              <Input aria-label={`Phase ${i + 1} description`} placeholder="Description" value={p.description} maxLength={1000} onChange={(e) => updatePhase(i, { description: e.target.value })} />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Progression criteria</p>
                {p.required_tests.map((t, j) => (
                  <Input key={j} aria-label={`Criterion ${j + 1}`} value={t} maxLength={200} placeholder="e.g. criterion set by the physiotherapist"
                    onChange={(e) => updatePhase(i, { required_tests: p.required_tests.map((x, k) => (k === j ? e.target.value : x)) })} />
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => updatePhase(i, { required_tests: [...p.required_tests, ''] })}>+ Criterion</Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Exercises</p>
                {p.exercises.map((ex, j) => (
                  <div key={j} className="grid sm:grid-cols-2 gap-2">
                    <Input aria-label={`Exercise ${j + 1}`} value={ex.title} maxLength={120} placeholder="Exercise"
                      onChange={(e) => updatePhase(i, { exercises: p.exercises.map((x, k) => (k === j ? { ...x, title: e.target.value } : x)) })} />
                    <Input aria-label={`Exercise ${j + 1} instructions`} value={ex.instructions} maxLength={1000} placeholder="Sets, reps, cues"
                      onChange={(e) => updatePhase(i, { exercises: p.exercises.map((x, k) => (k === j ? { ...x, instructions: e.target.value } : x)) })} />
                  </div>
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => updatePhase(i, { exercises: [...p.exercises, { title: '', instructions: '' }] })}>+ Exercise</Button>
              </div>
              {draft.length > 1 && <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 mr-1" />Remove phase</Button>}
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setDraft((d) => [...d, { title: '', description: '', required_tests: [''], exercises: [{ title: '', instructions: '' }] }])}>+ Phase</Button>
            <Button onClick={savePlan} disabled={saving || draft.some((p) => !p.title.trim())}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Save plan</Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {milestones.map((m) => (
            <MilestoneCard key={m.id} milestone={m} blocks={blocks.filter((b) => b.milestone_id === m.id)}
              canManage={canManage} isOwner={activeId === user?.id} athleteId={activeId} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  );
}
