import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'coach' && user.role !== 'admin') {
      return Response.json({ error: 'Only coaches can remove athletes' }, { status: 403 });
    }

    const body = await req.json();
    const assignmentId = body.assignment_id;
    if (!assignmentId) return Response.json({ error: 'assignment_id required' }, { status: 400 });

    const assignment = await base44.asServiceRole.entities.Assignment.get(assignmentId);
    if (!assignment) return Response.json({ error: 'Assignment not found' }, { status: 404 });

    if (assignment.coach_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'You can only remove your own athletes' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Assignment.update(assignmentId, { status: 'removed' });

    // Remove from team if applicable
    if (assignment.team_id && assignment.athlete_id) {
      const members = await base44.asServiceRole.entities.TeamMember.filter({
        team_id: assignment.team_id,
        user_id: assignment.athlete_id
      }, { limit: 1 });
      if (members.items?.length) {
        await base44.asServiceRole.entities.TeamMember.delete(members.items[0].id);
      }
    }

    return Response.json({ success: true, message: 'Athlete removed' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}