import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const role = body.role;
    const sport = body.sport;
    const bio = body.bio;
    const profile_image_url = body.profile_image_url;
    const full_name = body.full_name;

    if (role && !['coach', 'athlete'].includes(role)) {
      return Response.json({ error: 'Role must be "coach" or "athlete"' }, { status: 400 });
    }

    // Update non-role fields first (always allowed)
    const update = { onboarded: true };
    if (sport !== undefined) update.sport = sport;
    if (bio !== undefined) update.bio = bio;
    if (profile_image_url !== undefined) update.profile_image_url = profile_image_url;
    if (full_name !== undefined) update.full_name = full_name;
    await base44.asServiceRole.entities.User.update(user.id, update);

    // Try role update separately (platform blocks role changes for app owner)
    if (role && user.role !== 'admin') {
      try {
        await base44.asServiceRole.entities.User.update(user.id, { role });
      } catch (_) {}
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}