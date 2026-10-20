import { seed } from './fake-sdk.ts';

export async function call(fn: (req: Request) => Promise<Response>, user: { id: string; email?: string; role?: string } | null, body: unknown) {
  const req = new Request('http://test/fn', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': JSON.stringify(user) } : {}) },
    body: JSON.stringify(body),
  });
  const res = await fn(req);
  return { status: res.status, body: await res.json() };
}

export function users() {
  const coachA = seed('User', { id: 'coachA', email: 'coach.a@example.com', role: 'coach', full_name: 'Coach A', onboarded: true });
  const coachB = seed('User', { id: 'coachB', email: 'coach.b@example.com', role: 'coach', full_name: 'Coach B', onboarded: true });
  const ath1 = seed('User', { id: 'ath1', email: 'Athlete.One@Example.com', role: 'athlete', full_name: 'Athlete One', onboarded: true });
  const ath2 = seed('User', { id: 'ath2', email: 'athlete.two@example.com', role: 'athlete', full_name: 'Athlete Two', onboarded: true });
  const admin = seed('User', { id: 'admin1', email: 'admin@example.com', role: 'admin', full_name: 'Admin', onboarded: true });
  return { coachA, coachB, ath1, ath2, admin };
}

/** An active coach–athlete link, as respondToInvitation would leave it. */
export function link(coachId: string, athlete: { id: string; email: string; full_name?: string }) {
  return seed('Assignment', { coach_id: coachId, athlete_id: athlete.id, athlete_email: athlete.email.toLowerCase(), athlete_name: athlete.full_name, status: 'active' });
}
