import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, readJson, verifyCoachAthleteLink } from '../../shared/coachAuth.ts';
import { canScheduleWorkout, isAdmin } from '../../shared/policy.ts';
import { ValidationError, optionalText, requireDate, requireId } from '../../shared/validation.ts';

const MAX_TARGETS = 100;

// Schedules a coach's workout for linked athletes or a team. Each athlete
// gets their own copy, so later edits to the source never rewrite an
// athlete's scheduled or completed session.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const workoutId = requireId(body.workout_id, 'workout_id');
    const date = requireDate(body.date, 'Date');
    const teamId = optionalText(body.team_id, 'team_id', 64);
    const athleteIds = Array.isArray(body.athlete_ids) ? body.athlete_ids.map((a) => requireId(a, 'athlete_ids')) : [];
    if (!teamId && athleteIds.length === 0) throw new ValidationError('Choose an athlete or a team');

    const db = base44.asServiceRole.entities;
    const source = await db.Workout.get(workoutId).catch(() => null);
    if (!source) return json({ error: 'Workout not found' }, 404);
    const decision = canScheduleWorkout(source, user);
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    const targets = new Set<string>();
    const skipped: string[] = [];
    for (const id of athleteIds) {
      if (isAdmin(user) || await verifyCoachAthleteLink(base44, user.id, id)) targets.add(id);
      else skipped.push(id);
    }
    if (teamId) {
      const team = await db.Team.get(teamId).catch(() => null);
      if (!team) return json({ error: 'Team not found' }, 404);
      if (team.coach_id !== user.id && !isAdmin(user)) return json({ error: 'You can only schedule for your own teams' }, 403);
      const members = await db.TeamMember.filter({ team_id: teamId, role: 'athlete' }, { limit: 500 });
      for (const m of members.items || []) {
        if (isAdmin(user) || await verifyCoachAthleteLink(base44, user.id, m.user_id)) targets.add(m.user_id);
        else skipped.push(m.user_id);
      }
    }
    if (targets.size === 0) return json({ error: 'None of the selected athletes are connected to you', skipped }, 400);
    if (targets.size > MAX_TARGETS) throw new ValidationError(`At most ${MAX_TARGETS} athletes per scheduling action`);

    const created = [];
    for (const athleteId of targets) {
      const copy = await db.Workout.create({
        user_id: athleteId,
        coach_id: user.id,
        prescribed_by_id: user.id,
        owner_scope: 'assigned',
        source_workout_id: source.id,
        date,
        title: source.title,
        focus: source.focus,
        estimated_duration: source.estimated_duration,
        blocks: source.blocks || [],
        notes: source.notes,
        status: 'planned',
        ai_generated: !!source.ai_generated,
      });
      await db.WorkoutAssignment.create({
        workout_id: copy.id,
        source_workout_id: source.id,
        workout_title: source.title,
        athlete_id: athleteId,
        coach_id: user.id,
        team_id: teamId,
        date,
      });
      created.push(copy.id);
    }
    return json({ scheduled: created.length, skipped: skipped.length });
  } catch (error) {
    return errorResponse(error);
  }
}
