/**
 * Calendar maths for the training calendar. Dates are plain ISO strings (YYYY-MM-DD) handled in
 * UTC so time zones can never shift a session to the neighbouring day. Pure functions.
 */

const DAY_MS = 86_400_000;

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The calendar date of a planned session: program start date + (week - 1) * 7 + (day - 1). */
export function sessionDate(startDate: string, week: number, day: number): string {
  return toIso(toUtc(startDate) + ((week - 1) * 7 + (day - 1)) * DAY_MS);
}

export interface GridDay {
  iso: string;
  inMonth: boolean;
}

/** Six rows of seven days covering a month. `weekStartsOn`: 0 = Sunday, 1 = Monday. */
export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1): GridDay[][] {
  const first = Date.UTC(year, month - 1, 1);
  const offset = (new Date(first).getUTCDay() - weekStartsOn + 7) % 7;
  const start = first - offset * DAY_MS;
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const iso = toIso(start + (w * 7 + d) * DAY_MS);
      return { iso, inMonth: Number(iso.slice(5, 7)) === month };
    }),
  );
}

/** Parses "YYYY-MM"; falls back to the month of `today` for anything else. */
export function parseMonth(value: string | undefined, today: string): { year: number; month: number } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? "");
  if (m && Number(m[1]) >= 2000 && Number(m[1]) <= 2100) return { year: Number(m[1]), month: Number(m[2]) };
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

/** "YYYY-MM" of the month `delta` months away. */
export function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface CalendarAssignment {
  assignmentId: string;
  athleteId: string;
  athleteName: string;
  programId: string;
  programTitle: string;
  startDate: string;
}
export interface CalendarSession {
  id: string;
  programId: string;
  week: number;
  day: number;
  title: string;
  minutes: number | null;
}
export interface CalendarCompletion { sessionId: string; athleteId: string; status: string }
export type EventStatus = "planned" | "completed" | "partial" | "skipped";

export interface CalendarEvent {
  date: string;
  sessionId: string;
  programId: string;
  programTitle: string;
  title: string;
  week: number;
  day: number;
  minutes: number | null;
  athleteId: string;
  athleteName: string;
  status: EventStatus;
}

/** Every planned session of every active assignment, placed on its date, with completion status. */
export function buildEvents(assignments: CalendarAssignment[], sessions: CalendarSession[], completions: CalendarCompletion[]): CalendarEvent[] {
  const done = new Map<string, string>();
  completions.forEach((c) => {
    const key = `${c.sessionId}:${c.athleteId}`;
    // A completed log wins over a partial one, which wins over skipped.
    const rank = { completed: 3, partial: 2, skipped: 1 } as Record<string, number>;
    if ((rank[c.status] ?? 0) > (rank[done.get(key) ?? ""] ?? 0)) done.set(key, c.status);
  });
  const byProgram = new Map<string, CalendarSession[]>();
  sessions.forEach((s) => byProgram.set(s.programId, [...(byProgram.get(s.programId) ?? []), s]));
  const events: CalendarEvent[] = [];
  for (const a of assignments) {
    for (const s of byProgram.get(a.programId) ?? []) {
      const status = (done.get(`${s.id}:${a.athleteId}`) as EventStatus | undefined) ?? "planned";
      events.push({
        date: sessionDate(a.startDate, s.week, s.day), sessionId: s.id, programId: a.programId, programTitle: a.programTitle,
        title: s.title, week: s.week, day: s.day, minutes: s.minutes, athleteId: a.athleteId, athleteName: a.athleteName, status,
      });
    }
  }
  return events.sort((x, y) => x.date.localeCompare(y.date) || x.title.localeCompare(y.title));
}
