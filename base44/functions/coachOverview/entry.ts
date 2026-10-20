import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, readJson } from '../../shared/coachAuth.ts';
import { isCoach } from '../../shared/policy.ts';
import { summarizeAthlete, addDays } from '../../shared/overview.ts';
import { isValidDateString, utcToday } from '../../shared/validation.ts';

const MAX_ATHLETES = 100;

// One call that summarizes every athlete actively linked to the caller.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isCoach(user)) return json({ error: 'Coach access only' }, 403);

    const body = await readJson(req).catch(() => ({}));
    // The browser sends its local date so "today" matches the coach's day.
    const today = isValidDateString((body as Record<string, unknown>).today) ? (body as Record<string, string>).today : utcToday();

    const db = base44.asServiceRole.entities;
    const links = await db.Assignment.filter({ coach_id: user.id, status: 'active' }, { limit: MAX_ATHLETES });
    const pending = await db.Assignment.filter({ coach_id: user.id, status: 'pending' }, { limit: 200 });
    const from = addDays(today, -13);

    const athletes = [];
    for (const a of links.items || []) {
      if (!a.athlete_id) continue;
      const [r, w] = await Promise.all([
        db.ReadinessEntry.filter({ user_id: a.athlete_id, date: { $gte: from } }, { sort: '-date', limit: 14 }),
        db.Workout.filter({ user_id: a.athlete_id, coach_id: user.id, date: { $gte: from } }, { sort: 'date', limit: 100 }),
      ]);
      athletes.push(summarizeAthlete({
        athlete_id: a.athlete_id,
        athlete_name: a.athlete_name || a.athlete_email,
        readiness: r.items || [],
        workouts: w.items || [],
      }, today));
    }
    return json({ today, athletes, pending_invitations: (pending.items || []).length, truncated: (links.items || []).length >= MAX_ATHLETES });
  } catch (error) {
    return errorResponse(error);
  }
}
