import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { createBlankBlock, createBlankItem, relabelBlocks, BLOCK_LABELS } from '@/lib/workoutUtils';

export default function AddToWorkoutDialog({ open, onOpenChange, exercise }) {
  const { user } = useCurrentUser();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && user) {
      setLoading(true); setError('');
      // Only the user's own editable workouts: not coach-prescribed copies and not recorded sessions.
      base44.entities.Workout.filter({ user_id: user.id }, { sort: '-updated_date', limit: 100 })
        .then((res) => setWorkouts((res.items || []).filter((w) => w.owner_scope !== 'assigned' && w.status !== 'completed' && w.status !== 'skipped')))
        .catch(() => setWorkouts([]))
        .finally(() => setLoading(false));
    }
  }, [open, user?.id]);

  const filtered = workouts.filter((w) => !search || w.title?.toLowerCase().includes(search.toLowerCase()));

  const addToWorkout = async (wk) => {
    setAdding(true);
    try {
      const blocks = wk.blocks && wk.blocks.length ? [...wk.blocks] : [createBlankBlock(0)];
      const lastBlock = blocks[blocks.length - 1];
      const newItem = createBlankItem(lastBlock.label || BLOCK_LABELS[blocks.length - 1], lastBlock.items?.length || 0);
      newItem.exercise_id = exercise.id;
      newItem.exercise_name = exercise.name;
      lastBlock.items = [...(lastBlock.items || []), newItem];
      const updated = { ...wk, blocks: relabelBlocks(blocks) };
      await base44.entities.Workout.update(wk.id, { blocks: updated.blocks });
      onOpenChange(false);
      window.location.href = '/planner';
    } catch (e) { setError(e?.message || 'Could not add the exercise'); }
    finally { setAdding(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add "{exercise?.name}" to Workout</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workouts..." className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm mb-2" />
            <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-1">
              {filtered.map((wk) => (
                <button key={wk.id} onClick={() => addToWorkout(wk)} disabled={adding}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition">
                  <p className="text-sm font-medium">{wk.title}</p>
                  <p className="text-xs text-muted-foreground">{wk.blocks?.length || 0} blocks · {wk.focus || 'mixed'}</p>
                </button>
              ))}
              {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No workouts found. Create one in the Planner first.</p>}
            </div>
          </>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}