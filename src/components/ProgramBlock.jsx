import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';

export default function ProgramBlock({ program }) {
  const [openWeek, setOpenWeek] = useState(0);

  if (!program?.weeks?.length) return null;

  return (
    <div className="space-y-3">
      {program.weeks.map((wk, i) => {
        const open = openWeek === i;
        return (
          <Card key={i} className="overflow-hidden">
            <button onClick={() => setOpenWeek(open ? -1 : i)}
              className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition text-left">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">{wk.week_number}</span>
                <div>
                  <p className="font-semibold text-sm">Week {wk.week_number} — {wk.phase || 'Training'}</p>
                  <p className="text-xs text-muted-foreground">{wk.focus || ''}{wk.intensity_factor ? ` · ${wk.intensity_factor}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{wk.days?.length || 0} days</Badge>
                {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>
            {open && (
              <div className="divide-y divide-border border-t border-border">
                {wk.days?.map((d, j) => (
                  <div key={j} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium text-sm">Day {d.day}: {d.title}</span>
                    </div>
                    <div className="space-y-1.5">
                      {d.exercises?.map((ex, k) => (
                        <div key={k} className="grid grid-cols-12 gap-2 text-xs items-center py-1">
                          <span className="col-span-5 font-medium">{ex.name}</span>
                          <span className="col-span-1 text-muted-foreground">{ex.sets}×{ex.reps}</span>
                          <span className="col-span-2 text-muted-foreground">{ex.load || '—'}</span>
                          <span className="col-span-4 text-muted-foreground truncate">{ex.notes || ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}