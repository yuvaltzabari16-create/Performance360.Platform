import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const INVITE_EXPIRY_DAYS = 14;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'coach' && user.role !== 'admin') {
      return Response.json({ error: 'Only coaches can invite athletes' }, { status: 403 });
    }

    const body = await req.json();
    const athleteEmail = (body.athlete_email || '').toLowerCase().trim();
    const teamId = body.team_id || undefined;

    if (!athleteEmail) return Response.json({ error: 'athlete_email required' }, { status: 400 });

    // Prevent duplicate pending/active invites for the same email + coach
    const existing = await base44.asServiceRole.entities.Assignment.filter({
      coach_id: user.id,
      athlete_email: athleteEmail,
      status: { $in: ['pending', 'active'] }
    }, { limit: 1 });

    if (existing.items?.length > 0) {
      return Response.json({ error: 'An active or pending invitation already exists for this athlete' }, { status: 409 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    let teamName = '';
    if (teamId) {
      const team = await base44.asServiceRole.entities.Team.get(teamId);
      teamName = team?.name || '';
    }

    const assignment = await base44.asServiceRole.entities.Assignment.create({
      coach_id: user.id,
      coach_name: user.full_name || user.email,
      athlete_email: athleteEmail,
      team_id: teamId,
      team_name: teamName,
      status: 'pending',
      expires_at: expiresAt.toISOString()
    });

    // Try to send email; only report as sent if it actually goes through
    let emailSent = false;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: athleteEmail,
        subject: (user.full_name || 'Your coach') + ' has invited you to ApexMotion',
        body: 'You have been invited to join ApexMotion as an athlete. Sign in with this email address to accept your invitation. The invitation expires in ' + INVITE_EXPIRY_DAYS + ' days.'
      });
      emailSent = true;
    } catch (_) {
      // Non-registered user or no custom domain — email not sent
    }

    return Response.json({ assignment, emailSent, inviteLink: '/' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}