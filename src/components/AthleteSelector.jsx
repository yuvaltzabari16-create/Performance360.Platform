import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AthleteSelector({ coachId, value, onChange }) {
  const [athletes, setAthletes] = useState([]);

  useEffect(() => {
    if (!coachId) return;
    base44.entities.Assignment.filter({ coach_id: coachId }, { limit: 100 })
      .then((res) => {
        const linked = (res.items || []).filter((a) => a.athlete_id);
        setAthletes(linked);
      })
      .catch(() => setAthletes([]));
  }, [coachId]);

  if (athletes.length === 0) {
    return <p className="text-sm text-muted-foreground">No linked athletes yet. Invite one from Profile.</p>;
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Select athlete" /></SelectTrigger>
      <SelectContent>
        {athletes.map((a) => (
          <SelectItem key={a.id} value={a.athlete_id}>{a.athlete_name || a.athlete_email}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}