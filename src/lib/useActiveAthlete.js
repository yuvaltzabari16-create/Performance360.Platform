import { useEffect, useState } from 'react';

export function useActiveAthlete(user) {
  const [athleteId, setAthleteId] = useState(() => localStorage.getItem('activeAthlete') || '');

  useEffect(() => {
    if (user?.role === 'athlete') {
      setAthleteId(user.id);
      localStorage.removeItem('activeAthlete');
    }
  }, [user]);

  const setActive = (id) => {
    setAthleteId(id);
    if (user?.role === 'coach') localStorage.setItem('activeAthlete', id);
  };

  const activeId = user?.role === 'coach' ? athleteId : user?.id;
  return { activeId, setAthleteId: setActive, isCoach: user?.role === 'coach' };
}