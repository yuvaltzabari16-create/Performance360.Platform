import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, getActiveLink, json, readJson } from '../../shared/coachAuth.ts';
import { messageSenderRole } from '../../shared/policy.ts';
import { validateMessage } from '../../shared/training.ts';
import { oneOf, requireId } from '../../shared/validation.ts';

// Coach–athlete messages. Only the two parties of an active link can write;
// sender identity and role come from the session, never from the request.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const action = oneOf(body.action ?? 'send', ['send', 'mark_read'] as const, 'action');
    const athleteId = requireId(body.athlete_id, 'athlete_id');
    const coachId = requireId(body.coach_id, 'coach_id');

    const link = await getActiveLink(base44, coachId, athleteId);
    const role = messageSenderRole(user, link);
    if (!role) return json({ error: 'You can only message an active coach–athlete connection' }, 403);

    const db = base44.asServiceRole.entities;
    if (action === 'mark_read') {
      const unread = await db.CollaborationMessage.filter(
        { athlete_id: athleteId, coach_id: coachId },
        { limit: 500 },
      );
      let marked = 0;
      for (const m of unread.items || []) {
        if (m.sender_id !== user.id && !m.read_at) {
          await db.CollaborationMessage.update(m.id, { read_at: new Date().toISOString() });
          marked++;
        }
      }
      return json({ marked });
    }

    const content = validateMessage(body.content);
    const message = await db.CollaborationMessage.create({
      athlete_id: athleteId,
      coach_id: coachId,
      sender_id: user.id,
      sender_name: user.full_name || user.email,
      sender_role: role,
      content,
    });
    return json({ message });
  } catch (error) {
    return errorResponse(error);
  }
}
