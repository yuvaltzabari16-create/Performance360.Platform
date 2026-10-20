import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Circle, CheckCircle2, Play, Dumbbell } from 'lucide-react';

export default function MilestoneCard({ milestone, unlocked, blocks, onUpdated }) {
  const [tests, setTests] = useState({});

  const allTestsDone = (milestone.required_tests || []).every((_, i) => tests[i]);

  const start = async () => {
    await base44.entities.ClearanceMilestone.update(milestone.id, { status: 'in_progress' });
    onUpdated?.();
  };
  const complete = async () => {
    await base44.entities.ClearanceMilestone.update(milestone.id, { status: 'completed' });
    await base44.entities.ExerciseBlock.updateMany(
      { milestone_id: milestone.id, user_id: milestone.user_id },
      { $set: { status: 'unlocked' } }
    );
    await base44.entities.ClearanceMilestone.updateMany(
      { user_id: milestone.user_id, order: milestone.order + 1 },
      { $set: { status: 'in_progress' } }
    );
    onUpdated?.();
  };

  const icon = milestone.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    : unlocked ? <Circle className="w-5 h-5 text-primary" />
    : <Lock className="w-5 h-5 text-muted-foreground" />;

  return (
    <Card className={`p-5 transition ${unlocked ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Phase {milestone.order}: {milestone.title}</h3>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              milestone.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
              milestone.status === 'in_progress' ? 'bg-blue-50 text-primary' : 'bg-slate-100 text-slate-500'
            }`}>{milestone.status.replace('_', ' ')}</span>
          </div>
          {milestone.description && <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>}

          {unlocked && milestone.status !== 'completed' && milestone.required_tests?.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clearance Tests</p>
              {milestone.required_tests.map((t, i) => (
                <label key={i} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!tests[i]} onChange={(e) => setTests((s) => ({ ...s, [i]: e.target.checked }))} className="w-4 h-4 accent-primary" />
                  {t}
                </label>
              ))}
            </div>
          )}

          {unlocked && milestone.status === 'locked' && (
            <Button size="sm" variant="outline" className="mt-4" onClick={start}>
              <Play className="w-4 h-4 mr-1.5" /> Begin Phase
            </Button>
          )}
          {unlocked && milestone.status === 'in_progress' && (
            <Button size="sm" className="mt-4" onClick={complete} disabled={!allTestsDone}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Complete & Unlock Next
            </Button>
          )}

          {milestone.status === 'completed' && blocks?.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Dumbbell className="w-3.5 h-3.5" /> Unlocked Exercises</p>
              {blocks.map((b) => (
                <div key={b.id} className="rounded-lg border border-border p-3 bg-secondary/40">
                  <p className="text-sm font-medium">{b.title}</p>
                  {b.instructions && <p className="text-xs text-muted-foreground mt-0.5">{b.instructions}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}