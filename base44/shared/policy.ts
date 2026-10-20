// Pure authorization and workflow rules shared by backend functions.
// Every function here is deterministic and unit-tested (see tests/).
// Backend functions load the records with the service role and then ask
// these helpers whether the caller may proceed. Entity RLS is the second
// layer; it cannot express relationship checks on its own.

import { sameEmail } from './validation.ts';

export type Role = 'admin' | 'coach' | 'athlete';
export const SELF_SELECTABLE_ROLES = ['coach', 'athlete'] as const;

export interface UserLike {
  id: string;
  email?: string;
  role?: string;
  onboarded?: boolean;
  full_name?: string;
}

export interface AssignmentLike {
  id?: string;
  coach_id: string;
  athlete_email?: string;
  athlete_id?: string;
  team_id?: string;
  status?: string;
  expires_at?: string;
}

export type Decision = { ok: true } | { ok: false; status: number; error: string };
const allow: Decision = { ok: true };
const deny = (status: number, error: string): Decision => ({ ok: false, status, error });

export const isAdmin = (u?: UserLike | null) => u?.role === 'admin';
export const isCoach = (u?: UserLike | null) => u?.role === 'coach' || u?.role === 'admin';

/**
 * Role selection is allowed once, during onboarding. After that only an
 * administrator (through the platform dashboard) may change a role.
 */
export function onboardingRoleDecision(user: UserLike, requested?: string): Decision {
  if (requested === undefined || requested === null || requested === '') return allow;
  if (!(SELF_SELECTABLE_ROLES as readonly string[]).includes(requested)) {
    return deny(400, 'Role must be "coach" or "athlete"');
  }
  if (user.role === 'admin') return deny(403, 'Administrator roles cannot be changed here');
  if (user.onboarded && user.role && user.role !== requested) {
    return deny(403, 'Your role is already set. Contact an administrator to change it.');
  }
  return allow;
}

export function isInvitationExpired(a: AssignmentLike, now: Date): boolean {
  if (!a.expires_at) return false;
  const t = Date.parse(a.expires_at);
  return Number.isFinite(t) && t < now.getTime();
}

/** May `user` accept or decline invitation `a`? */
export function respondDecision(a: AssignmentLike, user: UserLike, now: Date): Decision {
  const addressedToUser = sameEmail(a.athlete_email, user.email) || (!!a.athlete_id && a.athlete_id === user.id);
  if (!addressedToUser) return deny(403, 'This invitation is not for you');
  if (a.coach_id === user.id) return deny(403, 'You cannot accept your own invitation');
  if (a.status !== 'pending') return deny(409, 'Invitation is already ' + (a.status || 'closed'));
  if (isInvitationExpired(a, now)) return deny(410, 'This invitation has expired');
  return allow;
}

/** May `user` create an invitation from coach `user` to `athleteEmail`? */
export function inviteDecision(user: UserLike, athleteEmail: string, team?: { coach_id?: string } | null): Decision {
  if (!isCoach(user)) return deny(403, 'Only coaches can invite athletes');
  if (sameEmail(athleteEmail, user.email)) return deny(400, 'You cannot invite yourself');
  if (team !== undefined && team !== null && team.coach_id !== user.id && !isAdmin(user)) {
    return deny(403, 'You can only invite athletes to your own teams');
  }
  return allow;
}

/**
 * Ending a relationship: the coach (or an admin) can remove an athlete or
 * revoke a pending invitation; the athlete can leave an active link.
 */
export function endRelationshipDecision(a: AssignmentLike, user: UserLike): Decision {
  if (a.status !== 'pending' && a.status !== 'active') {
    return deny(409, 'This relationship is already ' + (a.status || 'closed'));
  }
  if (isAdmin(user) || a.coach_id === user.id) return allow;
  if (a.status === 'active' && a.athlete_id && a.athlete_id === user.id) return allow;
  return deny(403, 'You are not part of this relationship');
}

/** Status to store when a relationship ends. */
export function endedStatus(a: AssignmentLike): 'removed' | 'revoked' {
  return a.status === 'pending' ? 'revoked' : 'removed';
}

/**
 * Message rules: only the two parties of an active coach–athlete link may
 * write in that thread. The sender's role is derived, never taken from input.
 */
export function messageSenderRole(user: UserLike, link: AssignmentLike | null): 'coach' | 'athlete' | null {
  if (!link || link.status !== 'active') return null;
  if (link.coach_id === user.id) return 'coach';
  if (link.athlete_id === user.id) return 'athlete';
  return null;
}

export interface WorkoutLike {
  id?: string;
  user_id?: string;
  coach_id?: string;
  created_by_id?: string;
  owner_scope?: string;
  status?: string;
}

/** Can a coach schedule this source workout? They must own it. */
export function canScheduleWorkout(source: WorkoutLike, user: UserLike): Decision {
  if (!isCoach(user)) return deny(403, 'Only coaches can schedule workouts for athletes');
  if (isAdmin(user)) return allow;
  if (source.created_by_id === user.id || source.user_id === user.id) return allow;
  return deny(403, 'You can only schedule workouts you own');
}

/** Athlete completion: only the athlete it was assigned to, and only once. */
export function completionDecision(w: WorkoutLike, user: UserLike): Decision {
  if (w.user_id !== user.id) return deny(403, 'You can only log your own workouts');
  if (w.status === 'completed' || w.status === 'skipped') {
    return deny(409, 'This session is already recorded as ' + w.status);
  }
  return allow;
}

/** Completed sessions are history: their prescription is locked. */
export function prescriptionEditable(w: WorkoutLike): boolean {
  return w.status !== 'completed' && w.status !== 'skipped';
}

/**
 * Session load (Foster et al., 2001): session RPE (CR-10) × duration in
 * minutes, in arbitrary units. Returns undefined unless both inputs exist.
 */
export function sessionLoad(rpe?: number, minutes?: number): number | undefined {
  if (typeof rpe !== 'number' || typeof minutes !== 'number') return undefined;
  if (!Number.isFinite(rpe) || !Number.isFinite(minutes) || rpe < 0 || minutes <= 0) return undefined;
  return Math.round(rpe * minutes);
}

/**
 * Rehab rules. Plans and phase progression are set by the coach; clearance
 * is a recorded professional decision, never computed by the app.
 */
export type MilestoneStatus = 'locked' | 'in_progress' | 'completed';

export function milestoneTransitionDecision(
  from: MilestoneStatus | string | undefined,
  to: MilestoneStatus | string,
  clearance: { cleared_by_name?: string; clearance_note?: string },
): Decision {
  const order = ['locked', 'in_progress', 'completed'];
  if (!order.includes(to)) return deny(400, 'Unknown status');
  const f = order.indexOf(from || 'locked');
  const t = order.indexOf(to);
  if (t === f) return deny(409, 'Milestone is already ' + to);
  if (t < f) return allow; // reopening a phase is allowed for the coach
  if (t - f > 1) return deny(409, 'Start the phase before completing it');
  if (to === 'completed' && !clearance.cleared_by_name) {
    return deny(400, 'Record the name of the professional who cleared this phase');
  }
  return allow;
}
