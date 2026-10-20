import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export function useCoachLink(user) {
  const [coachName, setCoachName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (!user || !user.email || user.role === 'coach' || user.role === 'admin') return;
    let active = true;
    (async () => {
      try {
        const res = await base44.entities.Assignment.filter({ athlete_email: user.email, status: 'active' }, { limit: 1 });
        const a = res.items?.[0];
        if (!a || !active) return;
        setCoachName(a.coach_name || 'Coach');
        setTeamName(a.team_name || '');
        setLinked(true);
      } catch (_) {}
    })();
    return () => { active = false; };
  }, [user]);

  return { coachName, teamName, linked };
}