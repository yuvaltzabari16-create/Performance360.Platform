import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, readJson } from '../../shared/coachAuth.ts';
import { endRelationshipDecision, endedStatus } from '../../shared/policy.ts';
import { requireId } from '../../shared/validation.ts';

// Ends a coach–athlete relationship. Used by coaches (remove an athlete or
// revoke a pending invitation) and by athletes (leave a coach). Access ends
// immediately because every cross-user function checks for an active link.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const assignmentId = requireId(body.assignment_id, 'assignment_id');
    const db = base44.asServiceRole.entities;
    const assignment = await db.Assignment.get(assignmentId).catch(() => null);
    if (!assignment) return json({ error: 'Relationship not found' }, 404);

    const decision = endRelationshipDecision(assignment, user);
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    const status = endedStatus(assignment);
    await db.Assignment.update(assignmentId, { status, ended_at: new Date().toISOString(), ended_by_id: user.id });

    if (assignment.athlete_id) {
      if (assignment.team_id) {
        const members = await db.TeamMember.filter({ team_id: assignment.team_id, user_id: assignment.athlete_id }, { limit: 10 });
        for (const m of members.items || []) await db.TeamMember.delete(m.id);
      }
      // Revoke read access to sessions this coach prescribed: Workout RLS lets
      // the coach named in coach_id read a session, so clear it and keep
      // prescribed_by_id for attribution. The athlete keeps every record.
      const prescribed = await db.Workout.filter({ user_id: assignment.athlete_id, coach_id: assignment.coach_id }, { limit: 2000 });
      for (const w of prescribed.items || []) {
        await db.Workout.update(w.id, { coach_id: '', prescribed_by_id: w.prescribed_by_id || assignment.coach_id });
      }
      // Clear or move the primary-coach pointer if it pointed at this coach.
      const athlete = await db.User.get(assignment.athlete_id).catch(() => null);
      if (athlete && athlete.coach_id === assignment.coach_id) {
        const others = await db.Assignment.filter({ athlete_id: assignment.athlete_id, status: 'active' }, { limit: 1 });
        await db.User.update(assignment.athlete_id, { coach_id: others.items?.[0]?.coach_id || '' });
      }
    }
    return json({ success: true, status });
  } catch (error) {
    return errorResponse(error);
  }
}
