import { useEffect, useState } from 'react';

const KEY = 'p360.activeAthlete';
const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const write = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

/**
 * The athlete whose data a page shows. Athletes always see themselves.
 * Coaches pick a connected athlete; the selection is a UI convenience only —
 * access is enforced by the backend on every read.
 */
export function useActiveAthlete(user) {
  const isCoach = user?.role === 'coach' || user?.role === 'admin';
  const [athleteId, setAthleteId] = useState(read);

  useEffect(() => { if (user && !isCoach) write(''); }, [user, isCoach]);

  const setActive = (id) => { setAthleteId(id); if (isCoach) write(id); };
  const activeId = isCoach ? athleteId : user?.id;
  return { activeId, setAthleteId: setActive, isCoach };
}
