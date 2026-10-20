import { base44 } from '@/api/base44Client';

/**
 * Reads an athlete's records. The athlete reads their own records directly
 * (entity RLS allows it). Anyone else goes through the athleteData backend
 * function, which re-checks the coach–athlete link on every call.
 */
export async function fetchAthleteRecords(user, athleteId, entity, { sort = '-created_date', limit = 100 } = {}) {
  if (!athleteId || !user) return [];
  if (athleteId === user.id) {
    const res = await base44.entities[entity].filter({ user_id: athleteId }, { sort, limit });
    return res.items || [];
  }
  const res = await base44.functions.invoke('athleteData', { athlete_id: athleteId, entity, sort, limit });
  return res.data?.items || [];
}

/** Extracts a readable message from a failed function call. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.error || err?.data?.error || err?.message || fallback;
}
