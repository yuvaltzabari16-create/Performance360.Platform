// Coach dashboard summary, computed from real records only. Follow-up flags
// are simple, documented rules to prompt a conversation; they are not
// injury-risk predictions or medical assessments.

export interface OverviewInput {
  athlete_id: string;
  athlete_name: string;
  readiness: { date: string; soreness?: number; sleep_hours?: number }[];
  workouts: { date?: string; status?: string }[];
}

export interface AthleteSummary {
  athlete_id: string;
  athlete_name: string;
  last_checkin: string | null;
  days_since_checkin: number | null;
  latest_soreness: number | null;
  past7: { scheduled: number; completed: number; skipped: number };
  next7: number;
  flags: string[];
}

const DAY = 86400000;
const toTime = (d: string) => Date.parse(d + 'T00:00:00Z');
export const addDays = (date: string, n: number) => new Date(toTime(date) + n * DAY).toISOString().slice(0, 10);

export const FLAG_RULES = {
  noCheckinDays: 3,
  highSoreness: 7,
};

export function summarizeAthlete(input: OverviewInput, today: string): AthleteSummary {
  const sorted = [...input.readiness].sort((a, b) => b.date.localeCompare(a.date));
  const last = sorted.find((r) => r.date <= today) || null;
  const days = last ? Math.round((toTime(today) - toTime(last.date)) / DAY) : null;
  const from = addDays(today, -6);
  const to = addDays(today, 7);
  const past = input.workouts.filter((w) => w.date && w.date >= from && w.date <= today);
  const next = input.workouts.filter((w) => w.date && w.date > today && w.date <= to && w.status !== 'completed' && w.status !== 'skipped');
  const past7 = {
    scheduled: past.length,
    completed: past.filter((w) => w.status === 'completed').length,
    skipped: past.filter((w) => w.status === 'skipped').length,
  };
  const soreness = typeof last?.soreness === 'number' ? last.soreness : null;
  const flags: string[] = [];
  if (days === null) flags.push('No wellness check-ins yet');
  else if (days >= FLAG_RULES.noCheckinDays) flags.push(`No check-in for ${days} days`);
  if (soreness !== null && soreness >= FLAG_RULES.highSoreness) flags.push(`Reported soreness ${soreness}/10 on ${last!.date}`);
  if (past7.skipped > 0) flags.push(`${past7.skipped} skipped session(s) this week`);
  const overdue = past.filter((w) => w.date! < today && (w.status === 'planned' || w.status === 'in_progress' || !w.status)).length;
  if (overdue > 0) flags.push(`${overdue} past session(s) not logged`);
  return {
    athlete_id: input.athlete_id,
    athlete_name: input.athlete_name,
    last_checkin: last?.date ?? null,
    days_since_checkin: days,
    latest_soreness: soreness,
    past7,
    next7: next.length,
    flags,
  };
}
