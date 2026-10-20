import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, readJson } from '../../shared/coachAuth.ts';
import { inviteDecision } from '../../shared/policy.ts';
import { canAddAthlete } from '../../shared/entitlements.ts';
import { ValidationError, isValidEmail, normalizeEmail, optionalText } from '../../shared/validation.ts';

const INVITE_EXPIRY_DAYS = 14;

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const athleteEmail = normalizeEmail(body.athlete_email);
    if (!isValidEmail(athleteEmail)) throw new ValidationError('Enter a valid email address');
    const teamId = optionalText(body.team_id, 'team_id', 64);

    let team = null;
    if (teamId) {
      team = await base44.asServiceRole.entities.Team.get(teamId).catch(() => null);
      if (!team) return json({ error: 'Team not found' }, 404);
    }
    const decision = inviteDecision(user, athleteEmail, teamId ? team : undefined);
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    const existing = await base44.asServiceRole.entities.Assignment.filter(
      { coach_id: user.id, athlete_email: athleteEmail, status: { $in: ['pending', 'active'] } },
      { limit: 1 },
    );
    const prior = existing.items?.[0];
    if (prior) {
      const msg = prior.status === 'active'
        ? 'This athlete is already connected to you'
        : 'An invitation to this athlete is already pending';
      return json({ error: msg }, 409);
    }

    // Plan limits apply only when ENFORCE_ENTITLEMENTS=true (off by default).
    const enforce = Deno.env.get('ENFORCE_ENTITLEMENTS') === 'true';
    if (enforce) {
      const [subs, active] = await Promise.all([
        base44.asServiceRole.entities.Subscription.filter({ owner_id: user.id }, { sort: '-created_date', limit: 1 }),
        base44.asServiceRole.entities.Assignment.filter({ coach_id: user.id, status: { $in: ['pending', 'active'] } }, { limit: 5000 }),
      ]);
      const ent = canAddAthlete(subs.items?.[0], (active.items || []).length, new Date(), true);
      if (!ent.ok) return json({ error: ent.error }, ent.status);
    }

    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86400000);
    const assignment = await base44.asServiceRole.entities.Assignment.create({
      coach_id: user.id,
      coach_name: user.full_name || user.email,
      athlete_email: athleteEmail,
      team_id: teamId,
      team_name: team?.name || '',
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    });

    // Only report the email as sent when the platform accepted it.
    let emailSent = false;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: athleteEmail,
        subject: (user.full_name || 'Your coach') + ' invited you to Performance360',
        body:
          'You have been invited to connect with your coach on Performance360. ' +
          'Sign in with this email address to accept or decline. ' +
          'The invitation expires in ' + INVITE_EXPIRY_DAYS + ' days.',
      });
      emailSent = true;
    } catch (err) {
      console.error('[inviteAthlete] email not sent', (err as Error)?.message);
    }

    return json({ assignment, emailSent });
  } catch (error) {
    return errorResponse(error);
  }
}
