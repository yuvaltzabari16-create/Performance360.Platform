// Runs the real backend function handlers against an in-memory fake of the
// Base44 service role. This verifies the functions' own authorization logic
// across several users. It does NOT exercise Base44's entity RLS, which can
// only be verified on a deployed app (see docs/TESTING.md).
import { beforeEach, describe, expect, test } from 'bun:test';
import { reset, seed, rows, sent, setLlm } from './fake-sdk.ts';
import { call, users, link } from './helpers.ts';
import inviteAthlete from '../base44/functions/inviteAthlete/entry.ts';
import respondToInvitation from '../base44/functions/respondToInvitation/entry.ts';
import removeAthlete from '../base44/functions/removeAthlete/entry.ts';
import onboardUser from '../base44/functions/onboardUser/entry.ts';
import athleteData from '../base44/functions/athleteData/entry.ts';
import assignWorkout from '../base44/functions/assignWorkout/entry.ts';
import completeWorkout from '../base44/functions/completeWorkout/entry.ts';
import recordMetric from '../base44/functions/recordMetric/entry.ts';
import sendMessage from '../base44/functions/sendMessage/entry.ts';
import manageRehab from '../base44/functions/manageRehab/entry.ts';
import coachOverview from '../base44/functions/coachOverview/entry.ts';
import analyzeMovement from '../base44/functions/analyzeMovement/entry.ts';

let U: ReturnType<typeof users>;
beforeEach(() => { reset(); U = users(); });

describe('authentication', () => {
  test('every function rejects anonymous callers', async () => {
    for (const fn of [inviteAthlete, respondToInvitation, removeAthlete, onboardUser, athleteData, assignWorkout, completeWorkout, recordMetric, sendMessage, manageRehab, coachOverview, analyzeMovement]) {
      expect((await call(fn, null, {})).status).toBe(401);
    }
  });
});

describe('onboarding', () => {
  test('a new user picks a role once; a later switch is refused', async () => {
    const u = seed('User', { id: 'new1', email: 'n@example.com', role: 'athlete', onboarded: false });
    expect((await call(onboardUser, u, { role: 'coach', sport: 'Football' })).status).toBe(200);
    expect(rows('User').find((r) => r.id === 'new1')).toMatchObject({ role: 'coach', onboarded: true });
    const again = await call(onboardUser, { ...u, role: 'coach', onboarded: true }, { role: 'athlete' });
    expect(again.status).toBe(403);
  });
  test('admin cannot be requested', async () => {
    expect((await call(onboardUser, U.ath1, { role: 'admin' })).status).toBe(400);
  });
});

describe('invitation lifecycle', () => {
  test('invite → accept (case-insensitive email) → active link with primary coach set', async () => {
    const inv = await call(inviteAthlete, U.coachA, { athlete_email: 'ATHLETE.ONE@example.com' });
    expect(inv.status).toBe(200);
    expect(inv.body.assignment.athlete_email).toBe('athlete.one@example.com');
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('Performance360');

    const res = await call(respondToInvitation, U.ath1, { assignment_id: inv.body.assignment.id, action: 'accept' });
    expect(res.status).toBe(200);
    expect(rows('Assignment')[0]).toMatchObject({ status: 'active', athlete_id: 'ath1' });
    expect(rows('User').find((r) => r.id === 'ath1')!.coach_id).toBe('coachA');
  });
  test('duplicate invitations and invitations from athletes are refused', async () => {
    await call(inviteAthlete, U.coachA, { athlete_email: 'x@example.com' });
    expect((await call(inviteAthlete, U.coachA, { athlete_email: 'X@example.com' })).status).toBe(409);
    expect((await call(inviteAthlete, U.ath1, { athlete_email: 'y@example.com' })).status).toBe(403);
  });
  test("a coach cannot invite into another coach's team", async () => {
    const team = seed('Team', { name: 'U19', coach_id: 'coachB' });
    expect((await call(inviteAthlete, U.coachA, { athlete_email: 'z@example.com', team_id: team.id })).status).toBe(403);
  });
  test('someone else cannot accept an invitation addressed to another email', async () => {
    const inv = await call(inviteAthlete, U.coachA, { athlete_email: 'athlete.one@example.com' });
    expect((await call(respondToInvitation, U.ath2, { assignment_id: inv.body.assignment.id, action: 'accept' })).status).toBe(403);
    expect(rows('Assignment')[0].status).toBe('pending');
  });
  test('expired invitations cannot be accepted and are marked expired', async () => {
    const a = seed('Assignment', { coach_id: 'coachA', athlete_email: 'athlete.two@example.com', status: 'pending', expires_at: '2020-01-01T00:00:00Z' });
    expect((await call(respondToInvitation, U.ath2, { assignment_id: a.id, action: 'accept' })).status).toBe(410);
    expect(rows('Assignment')[0].status).toBe('expired');
  });
  test('team invitation adds the athlete to the team on accept', async () => {
    const team = seed('Team', { name: 'U17', coach_id: 'coachA' });
    const inv = await call(inviteAthlete, U.coachA, { athlete_email: 'athlete.two@example.com', team_id: team.id });
    await call(respondToInvitation, U.ath2, { assignment_id: inv.body.assignment.id, action: 'accept' });
    expect(rows('TeamMember')).toHaveLength(1);
    expect(rows('TeamMember')[0]).toMatchObject({ team_id: team.id, user_id: 'ath2', coach_id: 'coachA' });
  });
});

describe('cross-user isolation (athleteData)', () => {
  beforeEach(() => {
    link('coachA', U.ath1);
    seed('PerformanceMetric', { user_id: 'ath1', metric_key: 'sprint_10m', value: 1.8, date: '2026-10-01' });
    seed('PerformanceMetric', { user_id: 'ath2', metric_key: 'sprint_10m', value: 1.9, date: '2026-10-01' });
  });
  test('linked coach reads only that athlete', async () => {
    const r = await call(athleteData, U.coachA, { athlete_id: 'ath1', entity: 'PerformanceMetric' });
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: any) => i.user_id)).toEqual(['ath1']);
  });
  test('unlinked coach and other athletes are refused', async () => {
    expect((await call(athleteData, U.coachB, { athlete_id: 'ath1', entity: 'PerformanceMetric' })).status).toBe(403);
    expect((await call(athleteData, U.coachA, { athlete_id: 'ath2', entity: 'PerformanceMetric' })).status).toBe(403);
    expect((await call(athleteData, U.ath2, { athlete_id: 'ath1', entity: 'PerformanceMetric' })).status).toBe(403);
  });
  test('entities outside the allow-list are refused (e.g. User, Assignment)', async () => {
    expect((await call(athleteData, U.coachA, { athlete_id: 'ath1', entity: 'User' })).status).toBe(400);
    expect((await call(athleteData, U.coachA, { athlete_id: 'ath1', entity: 'CollaborationMessage' })).status).toBe(400);
  });
  test('removing the athlete revokes the coach immediately', async () => {
    const a = rows('Assignment')[0];
    expect((await call(removeAthlete, U.coachA, { assignment_id: a.id })).status).toBe(200);
    expect((await call(athleteData, U.coachA, { athlete_id: 'ath1', entity: 'PerformanceMetric' })).status).toBe(403);
  });
  test("removal also clears the coach from that athlete's prescribed sessions", async () => {
    seed('Workout', { user_id: 'ath1', coach_id: 'coachA', owner_scope: 'assigned', title: 'S' });
    seed('Workout', { user_id: 'ath1', coach_id: 'coachB', owner_scope: 'assigned', title: 'Other coach' });
    await call(removeAthlete, U.coachA, { assignment_id: rows('Assignment')[0].id });
    const ws = rows('Workout');
    expect(ws.find((w) => w.title === 'S')).toMatchObject({ coach_id: '', prescribed_by_id: 'coachA' });
    expect(ws.find((w) => w.title === 'Other coach')!.coach_id).toBe('coachB');
  });
  test('the athlete can leave; another coach cannot end the link', async () => {
    const a = rows('Assignment')[0];
    expect((await call(removeAthlete, U.coachB, { assignment_id: a.id })).status).toBe(403);
    expect((await call(removeAthlete, U.ath1, { assignment_id: a.id })).status).toBe(200);
    expect(rows('Assignment')[0].status).toBe('removed');
  });
  test('revoking a pending invitation records "revoked"', async () => {
    const inv = await call(inviteAthlete, U.coachA, { athlete_email: 'new@example.com' });
    await call(removeAthlete, U.coachA, { assignment_id: inv.body.assignment.id });
    expect(rows('Assignment').find((r) => r.id === inv.body.assignment.id)!.status).toBe('revoked');
  });
});

describe('training assignment and completion', () => {
  let source: any;
  beforeEach(() => {
    link('coachA', U.ath1);
    source = seed('Workout', { user_id: 'coachA', created_by_id: 'coachA', owner_scope: 'coach_library', title: 'Speed A', blocks: [{ id: 'b0', items: [{ exercise_name: 'Sprint', sets: 4 }] }] });
  });
  test('scheduling copies the workout only to linked athletes', async () => {
    const r = await call(assignWorkout, U.coachA, { workout_id: source.id, date: '2026-10-22', athlete_ids: ['ath1', 'ath2'] });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ scheduled: 1, skipped: 1 });
    const copies = rows('Workout').filter((w) => w.owner_scope === 'assigned');
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ user_id: 'ath1', coach_id: 'coachA', source_workout_id: source.id, date: '2026-10-22' });
  });
  test("a coach cannot schedule another coach's workout", async () => {
    link('coachB', U.ath1);
    expect((await call(assignWorkout, U.coachB, { workout_id: source.id, date: '2026-10-22', athlete_ids: ['ath1'] })).status).toBe(403);
  });
  test('team scheduling only reaches team members with an active link', async () => {
    const team = seed('Team', { name: 'U19', coach_id: 'coachA' });
    seed('TeamMember', { team_id: team.id, user_id: 'ath1', role: 'athlete', coach_id: 'coachA' });
    seed('TeamMember', { team_id: team.id, user_id: 'ath2', role: 'athlete', coach_id: 'coachA' }); // forged row, no link
    const r = await call(assignWorkout, U.coachA, { workout_id: source.id, date: '2026-10-22', team_id: team.id });
    expect(r.body).toEqual({ scheduled: 1, skipped: 1 });
  });
  test('athlete logs results without changing the prescription; logging twice is refused', async () => {
    await call(assignWorkout, U.coachA, { workout_id: source.id, date: '2026-10-22', athlete_ids: ['ath1'] });
    const copy = rows('Workout').find((w) => w.owner_scope === 'assigned')!;
    expect((await call(completeWorkout, U.ath2, { workout_id: copy.id })).status).toBe(403);
    expect((await call(completeWorkout, U.coachA, { workout_id: copy.id })).status).toBe(403);
    const r = await call(completeWorkout, U.ath1, { workout_id: copy.id, session_rpe: 7, duration_min: 45, item_results: [{ block_id: 'b0', item_index: 0, sets_done: 3 }], blocks: [] });
    expect(r.status).toBe(200);
    const after = rows('Workout').find((w) => w.id === copy.id)!;
    expect(after.blocks).toEqual(source.blocks);
    expect(after.athlete_result).toMatchObject({ session_rpe: 7, duration_min: 45, session_load: 315 });
    expect(rows('WorkoutAssignment')[0].status).toBe('completed');
    expect((await call(completeWorkout, U.ath1, { workout_id: copy.id })).status).toBe(409);
  });
});

describe('performance data entry', () => {
  test('coach records for a linked athlete; recorder and source are set server-side', async () => {
    link('coachA', U.ath1);
    const r = await call(recordMetric, U.coachA, { athlete_id: 'ath1', metric_key: 'cmj_height', value: 41.2, date: '2026-10-19', source: 'athlete', recorded_by_id: 'ath1' });
    expect(r.status).toBe(200);
    expect(r.body.record).toMatchObject({ user_id: 'ath1', coach_id: 'coachA', recorded_by_id: 'coachA', source: 'coach', unit: 'cm' });
  });
  test('unlinked coach cannot write into an athlete\'s history', async () => {
    expect((await call(recordMetric, U.coachB, { athlete_id: 'ath1', metric_key: 'cmj_height', value: 41, date: '2026-10-19' })).status).toBe(403);
    expect(rows('PerformanceMetric')).toHaveLength(0);
  });
  test('earlier results are kept as history', async () => {
    await call(recordMetric, U.ath1, { metric_key: 'sprint_10m', value: 1.85, date: '2026-09-01' });
    await call(recordMetric, U.ath1, { metric_key: 'sprint_10m', value: 1.80, date: '2026-10-01' });
    expect(rows('PerformanceMetric')).toHaveLength(2);
  });
  test('wellness check-ins are athlete-only and one per day (second save updates)', async () => {
    link('coachA', U.ath1);
    expect((await call(recordMetric, U.coachA, { kind: 'readiness', athlete_id: 'ath1', date: '2026-10-20', sleep_hours: 8 })).status).toBe(403);
    const today = new Date().toISOString().slice(0, 10);
    await call(recordMetric, U.ath1, { kind: 'readiness', date: today, sleep_hours: 7 });
    await call(recordMetric, U.ath1, { kind: 'readiness', date: today, sleep_hours: 8 });
    expect(rows('ReadinessEntry')).toHaveLength(1);
    expect(rows('ReadinessEntry')[0].sleep_hours).toBe(8);
  });
  test('invalid values are rejected with 400', async () => {
    expect((await call(recordMetric, U.ath1, { metric_key: 'sprint_10m', value: 30, date: '2026-10-01' })).status).toBe(400);
  });
});

describe('messages', () => {
  test('only the two linked parties can message; role comes from the link', async () => {
    link('coachA', U.ath1);
    const ok = await call(sendMessage, U.ath1, { athlete_id: 'ath1', coach_id: 'coachA', content: 'Hamstring tight today', sender_role: 'coach' });
    expect(ok.status).toBe(200);
    expect(ok.body.message).toMatchObject({ sender_id: 'ath1', sender_role: 'athlete' });
    expect((await call(sendMessage, U.coachB, { athlete_id: 'ath1', coach_id: 'coachA', content: 'hi' })).status).toBe(403);
    expect((await call(sendMessage, U.ath2, { athlete_id: 'ath1', coach_id: 'coachA', content: 'hi' })).status).toBe(403);
    expect((await call(sendMessage, U.coachB, { athlete_id: 'ath1', coach_id: 'coachB', content: 'hi' })).status).toBe(403);
  });
  test('mark_read only marks messages from the other party', async () => {
    link('coachA', U.ath1);
    await call(sendMessage, U.coachA, { athlete_id: 'ath1', coach_id: 'coachA', content: 'Plan updated' });
    await call(sendMessage, U.ath1, { athlete_id: 'ath1', coach_id: 'coachA', content: 'Thanks' });
    const r = await call(sendMessage, U.ath1, { action: 'mark_read', athlete_id: 'ath1', coach_id: 'coachA' });
    expect(r.body.marked).toBe(1);
    const msgs = rows('CollaborationMessage');
    expect(msgs.find((m) => m.sender_id === 'coachA')!.read_at).toBeTruthy();
    expect(msgs.find((m) => m.sender_id === 'ath1')!.read_at).toBeUndefined();
  });
});

describe('return-to-play', () => {
  beforeEach(() => link('coachA', U.ath1));
  const plan = [{ title: 'Protection', required_tests: ['Pain-free walking'], exercises: [{ title: 'Isometric hold' }] }, { title: 'Loading', exercises: [] }];

  test('only a linked coach creates the plan; athletes and other coaches cannot', async () => {
    expect((await call(manageRehab, U.ath1, { action: 'create_plan', athlete_id: 'ath1', phases: plan })).status).toBe(403);
    expect((await call(manageRehab, U.coachB, { action: 'create_plan', athlete_id: 'ath1', phases: plan })).status).toBe(403);
    expect((await call(manageRehab, U.coachA, { action: 'create_plan', athlete_id: 'ath1', phases: plan })).status).toBe(200);
    expect(rows('ClearanceMilestone')).toHaveLength(2);
  });
  test('athlete cannot self-clear; clearance needs a named professional; start unlocks exercises', async () => {
    await call(manageRehab, U.coachA, { action: 'create_plan', athlete_id: 'ath1', phases: plan });
    const ms = rows('ClearanceMilestone').find((m) => m.order === 1)!;
    expect((await call(manageRehab, U.ath1, { action: 'set_status', athlete_id: 'ath1', milestone_id: ms.id, status: 'completed', cleared_by_name: 'me' })).status).toBe(403);
    expect((await call(manageRehab, U.coachA, { action: 'set_status', athlete_id: 'ath1', milestone_id: ms.id, status: 'in_progress' })).status).toBe(200);
    expect(rows('ExerciseBlock')[0].status).toBe('unlocked');
    expect((await call(manageRehab, U.coachA, { action: 'set_status', athlete_id: 'ath1', milestone_id: ms.id, status: 'completed' })).status).toBe(400);
    const ok = await call(manageRehab, U.coachA, { action: 'set_status', athlete_id: 'ath1', milestone_id: ms.id, status: 'completed', cleared_by_name: 'Dana Levi, physio' });
    expect(ok.body.milestone).toMatchObject({ status: 'completed', cleared_by_name: 'Dana Levi, physio', recorded_by_id: 'coachA' });
  });
  test('athlete completes only their own unlocked exercises', async () => {
    await call(manageRehab, U.coachA, { action: 'create_plan', athlete_id: 'ath1', phases: plan });
    const block = rows('ExerciseBlock')[0];
    expect((await call(manageRehab, U.ath1, { action: 'complete_exercise', block_id: block.id })).status).toBe(409);
    expect((await call(manageRehab, U.ath2, { action: 'complete_exercise', block_id: block.id })).status).toBe(403);
  });
  test('reopening a completed phase withdraws the clearance', async () => {
    await call(manageRehab, U.coachA, { action: 'create_plan', athlete_id: 'ath1', phases: plan });
    const ms = rows('ClearanceMilestone').find((m) => m.order === 1)!;
    await call(manageRehab, U.coachA, { action: 'set_status', athlete_id: 'ath1', milestone_id: ms.id, status: 'in_progress' });
    await call(manageRehab, U.coachA, { action: 'set_status', athlete_id: 'ath1', milestone_id: ms.id, status: 'completed', cleared_by_name: 'Dana' });
    await call(manageRehab, U.coachA, { action: 'set_status', athlete_id: 'ath1', milestone_id: ms.id, status: 'in_progress' });
    expect(rows('ClearanceMilestone').find((m) => m.id === ms.id)).toMatchObject({ status: 'in_progress', cleared_by_name: '', cleared_at: null });
  });
});

describe('coach overview', () => {
  test('summarizes only actively linked athletes and only real records', async () => {
    link('coachA', U.ath1);
    seed('ReadinessEntry', { user_id: 'ath2', date: '2026-10-19', soreness: 9 });
    seed('ReadinessEntry', { user_id: 'ath1', date: '2026-10-19', soreness: 3 });
    const r = await call(coachOverview, U.coachA, { today: '2026-10-20' });
    expect(r.status).toBe(200);
    expect(r.body.athletes.map((a: any) => a.athlete_id)).toEqual(['ath1']);
    expect(r.body.athletes[0].latest_soreness).toBe(3);
    expect((await call(coachOverview, U.ath1, {})).status).toBe(403);
  });
});

describe('video analysis', () => {
  test('no fabricated feedback when the model cannot read the video', async () => {
    setLlm(() => { throw new Error('vision unavailable'); });
    const r = await call(analyzeMovement, U.ath1, { video_url: 'https://files.example/v.mp4', file_uri: 'private/v.mp4' });
    expect(r.status).toBe(502);
    expect(rows('MovementAnalysis')[0]).toMatchObject({ status: 'failed', user_id: 'ath1' });
    expect(rows('MovementAnalysis')[0].ai_feedback).toBeUndefined();
  });
  test('unlinked coach cannot attach analyses to an athlete', async () => {
    expect((await call(analyzeMovement, U.coachB, { video_url: 'https://x/v.mp4', file_uri: 'f', athlete_id: 'ath1' })).status).toBe(403);
  });
});
