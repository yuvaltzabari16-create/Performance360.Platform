import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, readJson, relationToAthlete } from '../../shared/coachAuth.ts';
import { milestoneTransitionDecision } from '../../shared/policy.ts';
import { validateRehabPlan } from '../../shared/training.ts';
import { oneOf, optionalText, requireId } from '../../shared/validation.ts';

// Return-to-play workflow. Coaches (or admins) create plans and move phases;
// completing a phase records the named professional who cleared it. The app
// never decides clearance. Athletes can only tick off exercises in a phase
// that their coach has started.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const action = oneOf(body.action, ['create_plan', 'set_status', 'complete_exercise'] as const, 'action');
    const db = base44.asServiceRole.entities;

    if (action === 'complete_exercise') {
      const block = await db.ExerciseBlock.get(requireId(body.block_id, 'block_id')).catch(() => null);
      if (!block) return json({ error: 'Exercise not found' }, 404);
      if (block.user_id !== user.id) return json({ error: 'You can only update your own rehab exercises' }, 403);
      if (block.status !== 'unlocked') return json({ error: 'This exercise is not available yet' }, 409);
      const updated = await db.ExerciseBlock.update(block.id, { status: 'completed', completed_at: new Date().toISOString() });
      return json({ block: updated });
    }

    const athleteId = requireId(body.athlete_id, 'athlete_id');
    const relation = await relationToAthlete(base44, user, athleteId);
    if (relation !== 'coach' && relation !== 'admin') {
      return json({ error: 'Only the athlete\'s coach can manage the rehab plan' }, 403);
    }

    if (action === 'create_plan') {
      const existing = await db.ClearanceMilestone.filter({ user_id: athleteId }, { limit: 1 });
      if (existing.items?.length) return json({ error: 'This athlete already has a rehab plan' }, 409);
      const phases = validateRehabPlan(body.phases);
      for (const p of phases) {
        const ms = await db.ClearanceMilestone.create({
          user_id: athleteId, coach_id: user.id, title: p.title, description: p.description,
          order: p.order, required_tests: p.required_tests, status: 'locked',
        });
        let n = 1;
        for (const e of p.exercises) {
          await db.ExerciseBlock.create({
            user_id: athleteId, coach_id: user.id, milestone_id: ms.id,
            title: e.title, instructions: e.instructions, status: 'locked', order: n++,
          });
        }
      }
      return json({ created: phases.length });
    }

    // set_status
    const ms = await db.ClearanceMilestone.get(requireId(body.milestone_id, 'milestone_id')).catch(() => null);
    if (!ms || ms.user_id !== athleteId) return json({ error: 'Phase not found' }, 404);
    const to = oneOf(body.status, ['locked', 'in_progress', 'completed'] as const, 'status');
    const clearance = {
      cleared_by_name: optionalText(body.cleared_by_name, 'Cleared by', 120),
      clearance_note: optionalText(body.clearance_note, 'Clearance note', 2000),
    };
    const decision = milestoneTransitionDecision(ms.status, to, clearance);
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    const patch: Record<string, unknown> = { status: to };
    if (to === 'completed') {
      Object.assign(patch, clearance, { cleared_at: new Date().toISOString(), recorded_by_id: user.id });
    } else if (ms.status === 'completed') {
      // Reopening a phase withdraws the recorded clearance.
      Object.assign(patch, { cleared_by_name: '', clearance_note: '', cleared_at: null, recorded_by_id: user.id });
    }
    const updated = await db.ClearanceMilestone.update(ms.id, patch);

    if (to === 'in_progress') {
      const blocks = await db.ExerciseBlock.filter({ milestone_id: ms.id, status: 'locked' }, { limit: 50 });
      for (const b of blocks.items || []) await db.ExerciseBlock.update(b.id, { status: 'unlocked' });
    }
    return json({ milestone: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
