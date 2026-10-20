import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, readJson } from '../../shared/coachAuth.ts';
import { onboardingRoleDecision } from '../../shared/policy.ts';
import { optionalText } from '../../shared/validation.ts';

// Completes onboarding. The role can be chosen once (coach or athlete);
// after onboarding only an administrator can change it.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const role = typeof body.role === 'string' ? body.role : undefined;
    const decision = onboardingRoleDecision(user, role);
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    const update: Record<string, unknown> = { onboarded: true };
    const sport = optionalText(body.sport, 'Sport', 80);
    const bio = optionalText(body.bio, 'Bio', 2000);
    const fullName = optionalText(body.full_name, 'Name', 120);
    const photo = optionalText(body.profile_image_url, 'Profile photo', 2048);
    if (sport !== undefined) update.sport = sport;
    if (bio !== undefined) update.bio = bio;
    if (fullName !== undefined) update.full_name = fullName;
    if (photo !== undefined) update.profile_image_url = photo;
    await base44.asServiceRole.entities.User.update(user.id, update);

    let roleSet = true;
    if (role && role !== user.role) {
      try {
        await base44.asServiceRole.entities.User.update(user.id, { role });
      } catch (err) {
        // The platform refuses role changes on some accounts (e.g. the app owner).
        console.error('[onboardUser] role update refused', (err as Error)?.message);
        roleSet = false;
      }
    }
    return json({ success: true, roleSet });
  } catch (error) {
    return errorResponse(error);
  }
}
