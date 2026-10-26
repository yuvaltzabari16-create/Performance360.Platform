/** Minors need a parent or guardian's consent before their data is used. */

export const ADULT_AGE = 18;

/** Whole years between a date of birth and a reference date (ISO strings); null without a date of birth. */
export function ageOn(dateOfBirth: string | null | undefined, today: string): number | null {
  if (!dateOfBirth) return null;
  const [by, bm, bd] = dateOfBirth.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
  if (![by, bm, bd, ty, tm, td].every(Number.isFinite)) return null;
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export const isMinor = (dateOfBirth: string | null | undefined, today: string) => {
  const age = ageOn(dateOfBirth, today);
  return age != null && age < ADULT_AGE;
};

export interface GuardianInfo {
  date_of_birth: string | null;
  guardian_consent_at: string | null;
}

/** A minor whose guardian consent has not been recorded. */
export const missingGuardianConsent = (a: GuardianInfo, today: string) => isMinor(a.date_of_birth, today) && !a.guardian_consent_at;
