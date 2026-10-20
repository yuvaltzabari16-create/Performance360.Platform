import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const assignmentId = body.assignment_id;
    const action = body.action;

    if (!assignmentId) return Response.json({ error: 'assignment_id required' }, { status: 400 });
    if (!['accept', 'decline'].includes(action)) {
      return Response.json({ error: 'action must be "accept" or "decline"' }, { status: 400 });
    }

    const assignment = await base44.asServiceRole.entities.Assignment.get(assignmentId);
    if (!assignment) return Response.json({ error: 'Invitation not found' }, { status: 404 });

    // Verify this invitation belongs to the signed-in user
    if (assignment.athlete_email !== user.email && assignment.athlete_id !== user.id) {
      return Response.json({ error: 'This invitation is not for you' }, { status: 403 });
    }

    if (assignment.status !== 'pending') {
      return Response.json({ error: 'Invitation is already ' + assignment.status }, { status: 400 });
    }

    // Check expiry
    if (assignment.expires_at && new Date(assignment.expires_at) < new Date()) {
      await base44.asServiceRole.entities.Assignment.update(assignmentId, { status: 'expired' });
      return Response.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    if (action === 'accept') {
      await base44.asServiceRole.entities.Assignment.update(assignmentId, {
        status: 'active',
        athlete_id: user.id,
        athlete_name: user.full_name || user.email
      });

      // Set coach_id on the user (field is locked, need service role)
      if (assignment.coach_id && user.coach_id !== assignment.coach_id) {
        await base44.asServiceRole.entities.User.update(user.id, { coach_id: assignment.coach_id });
      }

      // If team assignment, create TeamMember
      if (assignment.team_id) {
        const existingMember = await base44.asServiceRole.entities.TeamMember.filter({
          team_id: assignment.team_id,
          user_id: user.id
        }, { limit: 1 });
        if (!existingMember.items?.length) {
          await base44.asServiceRole.entities.TeamMember.create({
            team_id: assignment.team_id,
            team_name: assignment.team_name,
            coach_id: assignment.coach_id,
            user_id: user.id,
            user_name: user.full_name || user.email,
            user_email: user.email,
            role: 'athlete'
          });
        }
      }

      return Response.json({ status: 'active', message: 'Invitation accepted' });
    } else {
      await base44.asServiceRole.entities.Assignment.update(assignmentId, { status: 'declined' });
      return Response.json({ status: 'declined', message: 'Invitation declined' });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}