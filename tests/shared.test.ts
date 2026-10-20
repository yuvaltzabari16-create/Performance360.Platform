import { describe, expect, test } from 'bun:test';
import { isValidDateString, requireNotFuture, sameEmail, isValidEmail, optionalNumber, ValidationError } from '../base44/shared/validation.ts';
import {
  onboardingRoleDecision, respondDecision, inviteDecision, endRelationshipDecision, endedStatus,
  messageSenderRole, canScheduleWorkout, completionDecision, prescriptionEditable, sessionLoad, milestoneTransitionDecision,
} from '../base44/shared/policy.ts';
import { validateMetric, reactiveStrengthIndex, rsaDecrement, changeVsPrevious, validateReadiness, METRICS } from '../base44/shared/metrics.ts';
import { validateCompletion, validateRehabPlan } from '../base44/shared/training.ts';
import { summarizeAthlete } from '../base44/shared/overview.ts';
import { activePlan, canAddAthlete } from '../base44/shared/entitlements.ts';

const now = new Date('2026-10-20T12:00:00Z');

describe('validation', () => {
  test('dates must exist on the calendar', () => {
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-2-3')).toBe(false);
    expect(isValidDateString(20261020)).toBe(false);
  });
  test('future dates are rejected beyond one day of tolerance', () => {
    expect(requireNotFuture('2026-10-21', '2026-10-20', 'd')).toBe('2026-10-21');
    expect(() => requireNotFuture('2026-10-23', '2026-10-20', 'd')).toThrow(ValidationError);
  });
  test('emails compare case-insensitively and never match empty', () => {
    expect(sameEmail('A@B.com ', 'a@b.com')).toBe(true);
    expect(sameEmail('', '')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
  });
  test('numbers respect bounds and reject NaN', () => {
    expect(optionalNumber('12.5', 'x', 0, 20)).toBe(12.5);
    expect(() => optionalNumber('abc', 'x', 0, 20)).toThrow();
    expect(() => optionalNumber(21, 'x', 0, 20)).toThrow();
    expect(optionalNumber('', 'x', 0, 20)).toBeUndefined();
  });
});

describe('roles and onboarding', () => {
  test('a role can be chosen once during onboarding', () => {
    expect(onboardingRoleDecision({ id: 'u', role: 'athlete', onboarded: false }, 'coach').ok).toBe(true);
  });
  test('an onboarded athlete cannot switch to coach', () => {
    const d = onboardingRoleDecision({ id: 'u', role: 'athlete', onboarded: true }, 'coach');
    expect(d.ok).toBe(false);
  });
  test('nobody can self-assign admin', () => {
    expect(onboardingRoleDecision({ id: 'u', role: 'athlete' }, 'admin').ok).toBe(false);
  });
  test('admins cannot be demoted through onboarding', () => {
    expect(onboardingRoleDecision({ id: 'u', role: 'admin' }, 'athlete').ok).toBe(false);
  });
});

describe('invitations and relationships', () => {
  const inv = { coach_id: 'c1', athlete_email: 'ath@example.com', status: 'pending', expires_at: '2026-10-30T00:00:00Z' };
  test('the addressed athlete can respond regardless of email case', () => {
    expect(respondDecision(inv, { id: 'a', email: 'ATH@example.com' }, now).ok).toBe(true);
  });
  test('another user cannot respond', () => {
    expect(respondDecision(inv, { id: 'x', email: 'other@example.com' }, now)).toMatchObject({ ok: false, status: 403 });
  });
  test('expired and closed invitations are rejected', () => {
    expect(respondDecision({ ...inv, expires_at: '2026-10-01T00:00:00Z' }, { id: 'a', email: 'ath@example.com' }, now)).toMatchObject({ status: 410 });
    expect(respondDecision({ ...inv, status: 'active' }, { id: 'a', email: 'ath@example.com' }, now)).toMatchObject({ status: 409 });
  });
  test('only coaches invite, not themselves, and only to their own team', () => {
    expect(inviteDecision({ id: 'a', role: 'athlete' }, 'x@example.com').ok).toBe(false);
    expect(inviteDecision({ id: 'c', role: 'coach', email: 'c@example.com' }, 'C@example.com').ok).toBe(false);
    expect(inviteDecision({ id: 'c', role: 'coach' }, 'x@example.com', { coach_id: 'other' }).ok).toBe(false);
    expect(inviteDecision({ id: 'c', role: 'coach' }, 'x@example.com', { coach_id: 'c' }).ok).toBe(true);
  });
  test('coach, athlete (active only) and admin can end a relationship; others cannot', () => {
    const active = { coach_id: 'c', athlete_id: 'a', status: 'active' };
    expect(endRelationshipDecision(active, { id: 'c' }).ok).toBe(true);
    expect(endRelationshipDecision(active, { id: 'a' }).ok).toBe(true);
    expect(endRelationshipDecision(active, { id: 'z', role: 'admin' }).ok).toBe(true);
    expect(endRelationshipDecision(active, { id: 'z', role: 'coach' }).ok).toBe(false);
    expect(endRelationshipDecision({ ...active, status: 'removed' }, { id: 'c' }).ok).toBe(false);
    expect(endedStatus({ coach_id: 'c', status: 'pending' })).toBe('revoked');
    expect(endedStatus(active)).toBe('removed');
  });
  test('message sender role is derived from the link, never supplied', () => {
    const l = { coach_id: 'c', athlete_id: 'a', status: 'active' };
    expect(messageSenderRole({ id: 'c' }, l)).toBe('coach');
    expect(messageSenderRole({ id: 'a' }, l)).toBe('athlete');
    expect(messageSenderRole({ id: 'z' }, l)).toBeNull();
    expect(messageSenderRole({ id: 'c' }, { ...l, status: 'removed' })).toBeNull();
    expect(messageSenderRole({ id: 'c' }, null)).toBeNull();
  });
});

describe('training', () => {
  test('coaches schedule only workouts they own', () => {
    expect(canScheduleWorkout({ created_by_id: 'c' }, { id: 'c', role: 'coach' }).ok).toBe(true);
    expect(canScheduleWorkout({ created_by_id: 'x', user_id: 'x' }, { id: 'c', role: 'coach' }).ok).toBe(false);
    expect(canScheduleWorkout({ created_by_id: 'a' }, { id: 'a', role: 'athlete' }).ok).toBe(false);
  });
  test('only the assigned athlete logs a session, and only once', () => {
    expect(completionDecision({ user_id: 'a', status: 'planned' }, { id: 'a' }).ok).toBe(true);
    expect(completionDecision({ user_id: 'a', status: 'planned' }, { id: 'c' }).ok).toBe(false);
    expect(completionDecision({ user_id: 'a', status: 'completed' }, { id: 'a' })).toMatchObject({ status: 409 });
    expect(prescriptionEditable({ status: 'completed' })).toBe(false);
  });
  test('session load = RPE × minutes, only when both exist', () => {
    expect(sessionLoad(7, 60)).toBe(420);
    expect(sessionLoad(undefined, 60)).toBeUndefined();
    expect(sessionLoad(7, 0)).toBeUndefined();
  });
  test('completion payload is validated and skipped sessions carry no results', () => {
    const ok = validateCompletion({ status: 'completed', session_rpe: '6', duration_min: 50, item_results: [{ block_id: 'b0', item_index: 0, sets_done: 3, reps_done: '5' }] });
    expect(ok.session_load).toBe(300);
    expect(() => validateCompletion({ session_rpe: 11 })).toThrow();
    expect(() => validateCompletion({ item_results: [{ block_id: 'b0', item_index: 1.5 }] })).toThrow();
    expect(validateCompletion({ status: 'skipped', session_rpe: 5, item_results: [{ block_id: 'b', item_index: 0 }] })).toEqual({ status: 'skipped', notes: undefined, item_results: [] });
  });
});

describe('performance tests catalog', () => {
  test('every catalog entry is well-formed', () => {
    const keys = new Set();
    for (const m of METRICS) {
      expect(keys.has(m.key)).toBe(false); keys.add(m.key);
      expect(m.min).toBeLessThan(m.max);
      expect(m.unit.length).toBeGreaterThan(0);
      expect(m.protocol.length).toBeGreaterThan(10);
    }
    for (const k of ['sprint_5m', 'sprint_10m', 'sprint_20m', 'sprint_30m', 'cmj_height', 'sj_height', 'dj_height', 'sl_cmj_height', 'cod_505', 'yoyo_ir1', 'rsa_best']) expect(keys.has(k)).toBe(true);
  });
  test('valid results are normalized with unit and category from the catalog', () => {
    const r = validateMetric({ metric_key: 'sprint_10m', value: '1.78', date: '2026-10-19' }, '2026-10-20');
    expect(r).toMatchObject({ metric_key: 'sprint_10m', unit: 's', category: 'speed', value: 1.78 });
  });
  test('implausible values, unknown tests, future dates and missing sides are rejected', () => {
    expect(() => validateMetric({ metric_key: 'sprint_10m', value: 18, date: '2026-10-19' }, '2026-10-20')).toThrow();
    expect(() => validateMetric({ metric_key: 'made_up', value: 1, date: '2026-10-19' }, '2026-10-20')).toThrow();
    expect(() => validateMetric({ metric_key: 'cmj_height', value: 40, date: '2026-12-01' }, '2026-10-20')).toThrow();
    expect(() => validateMetric({ metric_key: 'sl_cmj_height', value: 20, date: '2026-10-19' }, '2026-10-20')).toThrow();
    expect(validateMetric({ metric_key: 'sl_cmj_height', value: 20, date: '2026-10-19', side: 'left' }, '2026-10-20').side).toBe('left');
  });
  test('derived metrics follow their documented formulas', () => {
    expect(reactiveStrengthIndex(30, 200)).toBe(1.5);
    expect(reactiveStrengthIndex(30, undefined)).toBeUndefined();
    expect(rsaDecrement(4.0, 4.2)).toBe(5);
    expect(rsaDecrement(4.2, 4.0)).toBeUndefined();
  });
  test('change vs previous is signed so positive always means improved', () => {
    expect(changeVsPrevious({ better: 'lower', unit: 's' }, { value: 1.7 }, { value: 1.8 })!.delta).toBeCloseTo(0.1);
    expect(changeVsPrevious({ better: 'higher', unit: 'cm' }, { value: 38 }, { value: 40 })!.delta).toBe(-2);
    expect(changeVsPrevious({ better: 'higher', unit: 'cm' }, { value: 38, unit: 'in' }, { value: 40 })).toBeUndefined();
    expect(changeVsPrevious({ better: 'higher', unit: 'cm' }, { value: 38 }, undefined)).toBeUndefined();
  });
  test('wellness check-in needs at least one value and respects scales', () => {
    expect(() => validateReadiness({ date: '2026-10-20' }, '2026-10-20')).toThrow();
    expect(() => validateReadiness({ date: '2026-10-20', soreness: 0 }, '2026-10-20')).toThrow();
    expect(validateReadiness({ date: '2026-10-20', sleep_hours: 7.5 }, '2026-10-20').mood).toBeUndefined();
  });
});

describe('return-to-play', () => {
  test('completing a phase requires a named professional', () => {
    expect(milestoneTransitionDecision('in_progress', 'completed', {}).ok).toBe(false);
    expect(milestoneTransitionDecision('in_progress', 'completed', { cleared_by_name: 'Dana, physio' }).ok).toBe(true);
  });
  test('phases cannot skip straight from locked to completed', () => {
    expect(milestoneTransitionDecision('locked', 'completed', { cleared_by_name: 'x' }).ok).toBe(false);
  });
  test('plans are validated and capped', () => {
    expect(() => validateRehabPlan([])).toThrow();
    expect(validateRehabPlan([{ title: 'Phase', required_tests: ['a'], exercises: [{ title: 'Iso hold' }] }])[0].order).toBe(1);
    expect(() => validateRehabPlan(Array.from({ length: 13 }, () => ({ title: 'x' })))).toThrow();
  });
});

describe('coach overview flags', () => {
  test('flags come only from recorded data', () => {
    const s = summarizeAthlete({
      athlete_id: 'a', athlete_name: 'A',
      readiness: [{ date: '2026-10-15', soreness: 8 }],
      workouts: [{ date: '2026-10-18', status: 'skipped' }, { date: '2026-10-19', status: 'planned' }, { date: '2026-10-20', status: 'completed' }, { date: '2026-10-22', status: 'planned' }],
    }, '2026-10-20');
    expect(s.days_since_checkin).toBe(5);
    expect(s.past7).toEqual({ scheduled: 3, completed: 1, skipped: 1 });
    expect(s.next7).toBe(1);
    expect(s.flags).toContain('No check-in for 5 days');
    expect(s.flags.some((f) => f.startsWith('Reported soreness 8/10'))).toBe(true);
    expect(s.flags).toContain('1 past session(s) not logged');
  });
  test('no data means no invented numbers', () => {
    const s = summarizeAthlete({ athlete_id: 'a', athlete_name: 'A', readiness: [], workouts: [] }, '2026-10-20');
    expect(s.last_checkin).toBeNull();
    expect(s.latest_soreness).toBeNull();
    expect(s.flags).toEqual(['No wellness check-ins yet']);
  });
});

describe('entitlements', () => {
  test('enforcement is off by default', () => {
    expect(canAddAthlete(null, 999, now, false).ok).toBe(true);
  });
  test('when enforced, a missing, canceled or lapsed subscription blocks invites', () => {
    expect(canAddAthlete(null, 0, now, true).ok).toBe(false);
    expect(canAddAthlete({ plan: 'club', status: 'canceled' }, 0, now, true).ok).toBe(false);
    expect(canAddAthlete({ plan: 'club', status: 'active', current_period_end: '2026-10-01T00:00:00Z' }, 0, now, true).ok).toBe(false);
    expect(activePlan({ plan: 'club', status: 'active', current_period_end: '2026-11-01T00:00:00Z' }, now)?.key).toBe('club');
  });
});
