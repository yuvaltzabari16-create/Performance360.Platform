// Subscription entitlements. Plan names and limits are placeholders for a
// business decision: every numeric limit is null ("not decided / unlimited")
// until the owner sets it. No prices live in code.
//
// Enforcement is OFF unless the backend secret ENFORCE_ENTITLEMENTS=true is
// set, so the current app keeps working while billing is not configured.
// A Subscription record must only ever be written by a verified payment
// webhook (not implemented — see docs/LAUNCH_CHECKLIST.md) or by an admin.

export type PlanKey = 'trial' | 'individual_coach' | 'club' | 'multi_team_club';

export interface Plan {
  key: PlanKey;
  label: string;
  maxActiveAthletes: number | null;
  maxTeams: number | null;
  features: { aiPlanning: boolean; videoAnalysis: boolean; pdfReports: boolean };
}

export const PLANS: Record<PlanKey, Plan> = {
  trial: { key: 'trial', label: 'Trial', maxActiveAthletes: null, maxTeams: null, features: { aiPlanning: true, videoAnalysis: true, pdfReports: true } },
  individual_coach: { key: 'individual_coach', label: 'Individual coach', maxActiveAthletes: null, maxTeams: null, features: { aiPlanning: true, videoAnalysis: true, pdfReports: true } },
  club: { key: 'club', label: 'Club', maxActiveAthletes: null, maxTeams: null, features: { aiPlanning: true, videoAnalysis: true, pdfReports: true } },
  multi_team_club: { key: 'multi_team_club', label: 'Multi-team club', maxActiveAthletes: null, maxTeams: null, features: { aiPlanning: true, videoAnalysis: true, pdfReports: true } },
};

export interface SubscriptionLike {
  plan?: string;
  status?: string; // trialing | active | past_due | canceled | expired
  current_period_end?: string;
}

/** Statuses that grant access. past_due keeps access during the provider's retry window. */
const ENTITLED = new Set(['trialing', 'active', 'past_due']);

export function activePlan(sub: SubscriptionLike | null | undefined, now: Date): Plan | null {
  if (!sub || !sub.status || !ENTITLED.has(sub.status)) return null;
  if (sub.current_period_end) {
    const end = Date.parse(sub.current_period_end);
    if (Number.isFinite(end) && end < now.getTime()) return null;
  }
  return PLANS[sub.plan as PlanKey] || null;
}

export type Entitlement = { ok: true } | { ok: false; status: 402; error: string };

/** May the coach add one more active athlete? */
export function canAddAthlete(sub: SubscriptionLike | null | undefined, activeCount: number, now: Date, enforce: boolean): Entitlement {
  if (!enforce) return { ok: true };
  const plan = activePlan(sub, now);
  if (!plan) return { ok: false, status: 402, error: 'An active subscription is required to invite athletes' };
  if (plan.maxActiveAthletes !== null && activeCount >= plan.maxActiveAthletes) {
    return { ok: false, status: 402, error: `Your ${plan.label} plan allows ${plan.maxActiveAthletes} active athletes` };
  }
  return { ok: true };
}
