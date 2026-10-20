import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, readJson } from '../../shared/coachAuth.ts';
import { completionDecision } from '../../shared/policy.ts';
import { validateCompletion } from '../../shared/training.ts';
import { requireId } from '../../shared/validation.ts';

// The athlete records what they actually did. The coach's prescription
// (blocks) is never modified here.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const workoutId = requireId(body.workout_id, 'workout_id');
    const db = base44.asServiceRole.entities;
    const workout = await db.Workout.get(workoutId).catch(() => null);
    if (!workout) return json({ error: 'Workout not found' }, 404);

    const decision = completionDecision(workout, user);
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    const result = validateCompletion(body);
    const completedAt = new Date().toISOString();
    const updated = await db.Workout.update(workoutId, {
      status: result.status,
      completed_at: completedAt,
      athlete_result: {
        session_rpe: result.session_rpe,
        duration_min: result.duration_min,
        session_load: result.session_load,
        notes: result.notes,
        item_results: result.item_results,
      },
    });

    const assignments = await db.WorkoutAssignment.filter({ workout_id: workoutId }, { limit: 5 });
    for (const a of assignments.items || []) {
      await db.WorkoutAssignment.update(a.id, { status: result.status, completed_at: completedAt });
    }
    return json({ workout: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
