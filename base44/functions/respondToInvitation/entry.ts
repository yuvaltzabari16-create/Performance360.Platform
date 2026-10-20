import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, readJson } from '../../shared/coachAuth.ts';
import { respondDecision, isInvitationExpired } from '../../shared/policy.ts';
import { oneOf, requireId } from '../../shared/validation.ts';

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const assignmentId = requireId(body.assignment_id, 'assignment_id');
    const action = oneOf(body.action, ['accept', 'decline'] as const, 'action');

    const db = base44.asServiceRole.entities;
    const assignment = await db.Assignment.get(assignmentId).catch(() => null);
    if (!assignment) return json({ error: 'Invitation not found' }, 404);

    const now = new Date();
    const decision = respondDecision(assignment, user, now);
    if (!decision.ok) {
      if (decision.status === 410 && assignment.status === 'pending' && isInvitationExpired(assignment, now)) {
        await db.Assignment.update(assignmentId, { status: 'expired' });
      }
      return json({ error: decision.error }, decision.status);
    }

    if (action === 'decline') {
      await db.Assignment.update(assignmentId, { status: 'declined', responded_at: now.toISOString() });
      return json({ status: 'declined', message: 'Invitation declined' });
    }

    if (user.role === 'coach') {
      return json({ error: 'This is a coach account. Sign in with an athlete account to accept.' }, 409);
    }

    await db.Assignment.update(assignmentId, {
      status: 'active',
      athlete_id: user.id,
      athlete_name: user.full_name || user.email,
      responded_at: now.toISOString(),
    });

    // Primary coach pointer (admin-only field, so service role is required).
    if (!user.coach_id) {
      await db.User.update(user.id, { coach_id: assignment.coach_id });
    }

    if (assignment.team_id) {
      const existing = await db.TeamMember.filter({ team_id: assignment.team_id, user_id: user.id }, { limit: 1 });
      if (!existing.items?.length) {
        await db.TeamMember.create({
          team_id: assignment.team_id,
          team_name: assignment.team_name,
          coach_id: assignment.coach_id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          user_email: user.email,
          role: 'athlete',
        });
      }
    }
    return json({ status: 'active', message: 'Invitation accepted' });
  } catch (error) {
    return errorResponse(error);
  }
}
