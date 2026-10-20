import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AISubstitutesButton({ exerciseName, exerciseLibrary, onPick }) {
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSubs = async () => {
    setOpen(true);
    setLoading(true);
    setSubs([]);
    try {
      const res = await base44.functions.invoke('suggestSubstitutes', {
        exercise_name: exerciseName,
        library: exerciseLibrary,
      });
      setSubs(res.data.substitutes || []);
    } catch (e) { setSubs([]); }
    finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={fetchSubs} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition whitespace-nowrap">
        <Sparkles className="w-2.5 h-2.5" /> AI Subs
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Substitutes for {exerciseName}</DialogTitle></DialogHeader>
          {loading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {subs.map((s, i) => (
                <button key={i} onClick={() => { onPick(s.exercise_name); setOpen(false); }}
                  className="w-full text-left p-2 rounded-lg hover:bg-accent transition">
                  <p className="text-sm font-medium">{s.exercise_name}</p>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                </button>
              ))}
              {subs.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No substitutes found.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}