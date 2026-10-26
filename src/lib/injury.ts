/**
 * Return-to-play: stages, vocabularies and date maths. Pure functions (no database, no UI) so
 * the rules shown on screen are the rules the tests check. The database enforces the same lists.
 *
 * The app records decisions made by qualified people; it never diagnoses or clears anyone itself.
 */

/** The six stages from injury to cleared, in order. */
export const INJURY_STAGES = ["rest", "rehab", "running", "modified", "full", "cleared"] as const;
export type InjuryStage = (typeof INJURY_STAGES)[number];

export const BODY_AREAS = ["hamstring", "quadriceps", "groin", "calf", "ankle", "knee", "hip", "foot", "lower_back", "shoulder", "head", "other"] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

export const INJURY_KINDS = ["muscle", "ligament", "tendon", "bone", "joint", "contusion", "concussion", "illness", "other"] as const;
export const MECHANISMS = ["contact", "non_contact", "overuse", "unknown"] as const;
export const SEVERITIES = ["minor", "moderate", "severe"] as const;
export const SIDES = ["left", "right", "both"] as const;

export type InjuryEventKind = "reported" | "stage_changed" | "note" | "cleared" | "updated" | "reopened";

/** Zero-based position of a stage on the track. */
export const stageIndex = (stage: string): number => Math.max(0, (INJURY_STAGES as readonly string[]).indexOf(stage));

/** The next stage, or null from the last one. */
export function nextStage(stage: InjuryStage): InjuryStage | null {
  return INJURY_STAGES[stageIndex(stage) + 1] ?? null;
}
/** The previous stage, or null from the first one. */
export function previousStage(stage: InjuryStage): InjuryStage | null {
  const i = stageIndex(stage);
  return i > 0 ? INJURY_STAGES[i - 1] : null;
}

/** Stages where the athlete can be selected for full team training. */
export const isAvailable = (stage: string) => stage === "full" || stage === "cleared";

const DAY_MS = 86_400_000;
const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days between two ISO dates (end minus start). */
export const daysBetween = (startIso: string, endIso: string) => Math.round((utc(endIso) - utc(startIso)) / DAY_MS);

/** Days out so far (or in total for a resolved injury). Never negative. */
export function daysOut(injuryDate: string, today: string, resolvedOn?: string | null): number {
  return Math.max(0, daysBetween(injuryDate, resolvedOn ?? today));
}

export type ReturnOutlook =
  | { kind: "none" }
  | { kind: "ahead"; days: number }
  | { kind: "today" }
  | { kind: "overdue"; days: number };

/** How the expected return date compares with today (for an open injury). */
export function returnOutlook(expectedReturn: string | null | undefined, today: string): ReturnOutlook {
  if (!expectedReturn) return { kind: "none" };
  const diff = daysBetween(today, expectedReturn);
  if (diff > 0) return { kind: "ahead", days: diff };
  if (diff === 0) return { kind: "today" };
  return { kind: "overdue", days: -diff };
}

/** Whether a roles list includes someone allowed to record clearance (mirrors the database rule). */
export const CLEARANCE_ORG_ROLES = ["head_coach", "head_of_performance", "physiotherapist"] as const;
export const canClearByOrgRole = (orgRole: string | null | undefined) => (CLEARANCE_ORG_ROLES as readonly string[]).includes(orgRole ?? "");
