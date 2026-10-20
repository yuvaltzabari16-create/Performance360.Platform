// Server-side helpers for backend functions. These read with the service
// role (which bypasses RLS), so every caller must authorize first with the
// pure rules in policy.ts.

import { ValidationError } from './validation.ts';

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

/** Turns thrown errors into safe JSON responses without leaking internals. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ValidationError) return json({ error: err.message }, err.status);
  console.error('[function error]', err instanceof Error ? err.message : String(err));
  return json({ error: 'Something went wrong. Please try again.' }, 500);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ValidationError('Request body must be a JSON object');
  }
}

// deno-lint-ignore no-explicit-any
type Client = any;

/** The active coach–athlete link, or null. */
export async function getActiveLink(base44: Client, coachId: string, athleteId: string) {
  if (!coachId || !athleteId) return null;
  const res = await base44.asServiceRole.entities.Assignment.filter(
    { coach_id: coachId, athlete_id: athleteId, status: 'active' },
    { limit: 1 },
  );
  return res.items?.[0] || null;
}

export async function verifyCoachAthleteLink(base44: Client, coachId: string, athleteId: string) {
  return (await getActiveLink(base44, coachId, athleteId)) !== null;
}

/**
 * Who may act on an athlete's records: the athlete, a coach with an active
 * link, or an admin. Returns the caller's relation or null.
 */
export async function relationToAthlete(base44: Client, user: { id: string; role?: string }, athleteId: string) {
  if (user.id === athleteId) return 'self' as const;
  if (user.role === 'admin') return 'admin' as const;
  if (await verifyCoachAthleteLink(base44, user.id, athleteId)) return 'coach' as const;
  return null;
}

export function llmError(err: unknown) {
  const msg = String((err as Error)?.message || err);
  if (msg.includes('rate') || msg.includes('429')) {
    return { error: 'AI service rate limit reached. Please try again shortly.', status: 429 };
  }
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('timed out')) {
    return { error: 'AI request timed out. Please try again.', status: 504 };
  }
  console.error('[llm error]', msg);
  return { error: 'The AI service returned an invalid response. Please try again.', status: 502 };
}
