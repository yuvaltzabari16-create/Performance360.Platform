import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, readJson, relationToAthlete } from '../../shared/coachAuth.ts';
import { oneOf, optionalNumber, requireId } from '../../shared/validation.ts';

// Read access to an athlete's records for the athlete, an actively linked
// coach, or an admin. The link is checked on every call, so removing an
// athlete revokes the coach's access immediately.
const SOURCES = {
  PerformanceMetric: 'user_id',
  ReadinessEntry: 'user_id',
  Workout: 'user_id',
  ClearanceMilestone: 'user_id',
  ExerciseBlock: 'user_id',
  MovementAnalysis: 'user_id',
} as const;
type Source = keyof typeof SOURCES;

const SORTS = ['-date', 'date', 'order', '-created_date', 'created_date', '-updated_date'] as const;

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const athleteId = requireId(body.athlete_id, 'athlete_id');
    const entity = oneOf(body.entity, Object.keys(SOURCES) as Source[], 'entity');
    const sort = body.sort === undefined ? '-created_date' : oneOf(body.sort, SORTS, 'sort');
    const limit = optionalNumber(body.limit, 'limit', 1, 500) ?? 100;

    const relation = await relationToAthlete(base44, user, athleteId);
    if (!relation) return json({ error: 'You do not have access to this athlete' }, 403);

    const res = await base44.asServiceRole.entities[entity].filter(
      { [SOURCES[entity]]: athleteId },
      { sort, limit: Math.floor(limit) },
    );
    return json({ items: res.items || [], relation });
  } catch (error) {
    return errorResponse(error);
  }
}
