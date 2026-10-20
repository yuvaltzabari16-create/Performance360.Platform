import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Lists the coach's currently connected athletes (active links only). */
export function useConnectedAthletes(coachId) {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!coachId) { setAthletes([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    base44.entities.Assignment.filter({ coach_id: coachId, status: 'active' }, { limit: 500 })
      .then((res) => { if (active) setAthletes((res.items || []).filter((a) => a.athlete_id)); })
      .catch(() => { if (active) setAthletes([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [coachId]);
  return { athletes, loading };
}

export default function AthleteSelector({ coachId, value, onChange }) {
  const { athletes, loading } = useConnectedAthletes(coachId);

  // Clear a remembered selection that is no longer a connected athlete.
  useEffect(() => {
    if (!loading && value && !athletes.some((a) => a.athlete_id === value)) onChange('');
  }, [loading, athletes, value]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading athletes…</p>;
  if (athletes.length === 0) {
    return <p className="text-sm text-muted-foreground">No connected athletes yet. Invite one from Athletes.</p>;
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-64" aria-label="Select athlete"><SelectValue placeholder="Select athlete" /></SelectTrigger>
      <SelectContent>
        {athletes.map((a) => (
          <SelectItem key={a.id} value={a.athlete_id}>{a.athlete_name || a.athlete_email}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
