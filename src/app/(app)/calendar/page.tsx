import Link from "next/link";
import { MonthGrid, STATUS_TONE } from "@/components/calendar/MonthGrid";
import { Badge, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { buildEvents, monthGrid, parseMonth, shiftMonth, type CalendarAssignment, type CalendarEvent, type CalendarSession } from "@/lib/calendar";

export const metadata = { title: "Calendar" };

type Row<T> = T & { athletes: { full_name: string } | null; training_programs: { id: string; title: string } | null };

/** Month calendar of assigned sessions. Coaches see their athletes; athletes see their own plan. */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile, org, t, locale } = await requireProfile();
  const readOnly = org?.org_role === "director"; // the director sees the schedule, not the planner
  const isAthlete = profile.role === "athlete";
  const tc = t.calendar;

  const today = new Date().toISOString().slice(0, 10);
  const { year, month } = parseMonth(sp.m, today);
  const weeks = monthGrid(year, month, locale === "he" ? 0 : 1);
  const first = weeks[0][0].iso;
  const last = weeks[5][6].iso;
  const selected = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today >= first && today <= last ? today : `${year}-${String(month).padStart(2, "0")}-01`;

  // Row-level security limits all of this to what the signed-in person may see.
  const { data: assignRows } = await supabase
    .from("program_assignments")
    .select("id, athlete_id, program_id, start_date, athletes(full_name), training_programs(id, title)")
    .eq("status", "active")
    .limit(1000);
  const assignments: CalendarAssignment[] = ((assignRows ?? []) as unknown as Row<{ id: string; athlete_id: string; program_id: string; start_date: string }>[]).map((a) => ({
    assignmentId: a.id, athleteId: a.athlete_id, athleteName: a.athletes?.full_name ?? "", programId: a.program_id,
    programTitle: a.training_programs?.title ?? "", startDate: a.start_date,
  }));
  const programIds = [...new Set(assignments.map((a) => a.programId))];
  const [{ data: sessionRows }, { data: completionRows }] = programIds.length
    ? await Promise.all([
        supabase.from("training_sessions").select("id, program_id, week_number, day_number, title, planned_duration_min").in("program_id", programIds).limit(5000),
        supabase.from("workout_completions").select("session_id, athlete_id, status").gte("completed_on", first).lte("completed_on", last).limit(5000),
      ])
    : [{ data: [] }, { data: [] }];
  const sessions: CalendarSession[] = (sessionRows ?? []).map((s) => ({ id: s.id, programId: s.program_id, week: s.week_number, day: s.day_number, title: s.title, minutes: s.planned_duration_min }));
  const events = buildEvents(assignments, sessions, (completionRows ?? []).map((c) => ({ sessionId: c.session_id, athleteId: c.athlete_id, status: c.status })));

  const eventsByDate = new Map<string, CalendarEvent[]>();
  events.filter((e) => e.date >= first && e.date <= last).forEach((e) => eventsByDate.set(e.date, [...(eventsByDate.get(e.date) ?? []), e]));
  const dayEvents = eventsByDate.get(selected) ?? [];

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const weekdays = weeks[0].map((d) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${d.iso}T00:00:00Z`)));
  const href = (m: string, d?: string) => `/calendar?m=${m}${d ? `&d=${d}` : ""}`;
  const here = `${year}-${String(month).padStart(2, "0")}`;
  const statusLabel = { planned: tc.statusPlanned, completed: tc.statusCompleted, partial: tc.statusPartial, skipped: tc.statusSkipped };

  return (
    <>
      <PageHeader title={tc.title} subtitle={isAthlete ? tc.subtitleAthlete : tc.subtitleCoach} />
      {assignments.length === 0 ? (
        <EmptyState title={tc.title} body={tc.empty} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold capitalize text-ink"><bdi>{monthLabel}</bdi></h2>
              <div className="flex items-center gap-1">
                <Link href={href(shiftMonth(year, month, -1))} aria-label={tc.previous} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">‹</Link>
                <Link href={href(today.slice(0, 7), today)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">{tc.today}</Link>
                <Link href={href(shiftMonth(year, month, 1))} aria-label={tc.next} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">›</Link>
              </div>
            </div>
            <MonthGrid
              weeks={weeks} eventsByDate={eventsByDate} selected={selected} today={today} weekdays={weekdays}
              hrefFor={(iso) => href(here, iso)} moreLabel={(n) => tc.more.replace("{n}", String(n))}
            />
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              {(Object.keys(statusLabel) as (keyof typeof statusLabel)[]).map((s) => (
                <li key={s} className={cx("rounded-md px-2 py-1 ring-1 ring-inset", STATUS_TONE[s])}>{statusLabel[s]}</li>
              ))}
            </ul>
          </div>

          <Card title={<bdi>{new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${selected}T00:00:00Z`))}</bdi>}>
            {dayEvents.length === 0 ? <p className="text-sm text-muted">{tc.noSessions}</p> : (
              <ul className="divide-y divide-line">
                {dayEvents.map((e) => (
                  <li key={`${e.sessionId}-${e.athleteId}`} className="space-y-1.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-ink"><bdi>{e.title}</bdi></div>
                        <div className="text-xs text-muted"><bdi>{e.programTitle}</bdi>{!isAthlete && <> · <Link href={`/athletes/${e.athleteId}`} className="hover:text-brand-700"><bdi>{e.athleteName}</bdi></Link></>}</div>
                      </div>
                      <Badge tone={e.status === "completed" ? "green" : e.status === "partial" ? "amber" : "gray"}>{statusLabel[e.status]}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {isAthlete
                        ? <Link className="font-medium text-brand-700 hover:underline" href={`/training/session/${e.sessionId}?athlete=${e.athleteId}&date=${selected}`}>{tc.openSession}</Link>
                        : !readOnly && <Link className="font-medium text-brand-700 hover:underline" href={`/training/${e.programId}?week=${e.week}&session=${e.sessionId}`}>{tc.openProgram}</Link>}
                      {e.minutes ? <span className="num text-muted">{e.minutes} {t.common.min}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
