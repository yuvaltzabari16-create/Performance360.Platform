import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function ExercisePicker({ open, onOpenChange, exerciseLibrary, onPick }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const categories = useMemo(() => {
    const set = new Set(exerciseLibrary.map((e) => e.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [exerciseLibrary]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return exerciseLibrary.filter((e) => {
      const matchSearch = !q || e.name?.toLowerCase().includes(q) || e.muscle_group?.toLowerCase().includes(q);
      const matchCat = category === 'all' || e.category === category;
      return matchSearch && matchCat;
    });
  }, [exerciseLibrary, search, category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Exercise</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises..." className="pl-8 h-9" />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 px-2 rounded-md border border-input bg-background text-sm">
            {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All' : c}</option>)}
          </select>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin space-y-1">
          {filtered.map((ex) => (
            <button key={ex.id} onClick={() => { onPick(ex); onOpenChange(false); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent text-left transition">
              <div>
                <p className="text-sm font-medium">{ex.name}</p>
                <p className="text-xs text-muted-foreground">{ex.muscle_group || ex.category}</p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{ex.difficulty}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No exercises found.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}