import Link from "next/link";
import { cx } from "@/components/ui";
import type { CalendarEvent, EventStatus, GridDay } from "@/lib/calendar";

/** Colour per completion status (also written as text in the day panel, never colour alone). */
export const STATUS_TONE: Record<EventStatus, string> = {
  planned: "bg-brand-100/80 text-brand-900 ring-brand-200",
  completed: "bg-gradient-to-b from-brand-500 to-brand-600 text-white ring-brand-700/40",
  partial: "bg-amber-100 text-amber-950 ring-amber-300",
  skipped: "bg-slate-100 text-slate-600 ring-slate-300 line-through",
};

interface Chip { key: string; title: string; status: EventStatus; count: number }

/** One chip per session per day; for coaches many athletes of the same session collapse into one chip. */
function chipsFor(events: CalendarEvent[]): Chip[] {
  const bySession = new Map<string, Chip>();
  for (const e of events) {
    const chip = bySession.get(e.sessionId);
    if (!chip) bySession.set(e.sessionId, { key: e.sessionId, title: e.title, status: e.status, count: 1 });
    else {
      chip.count += 1;
      // Show the least-finished state so nothing looks done while someone still owes it.
      const order: EventStatus[] = ["planned", "partial", "skipped", "completed"];
      if (order.indexOf(e.status) < order.indexOf(chip.status)) chip.status = e.status;
    }
  }
  return [...bySession.values()];
}

/** Month view: seven columns, one cell per day, each a link that selects the day. */
export function MonthGrid({ weeks, eventsByDate, selected, today, hrefFor, weekdays, moreLabel }: {
  weeks: GridDay[][];
  eventsByDate: Map<string, CalendarEvent[]>;
  selected: string;
  today: string;
  hrefFor: (iso: string) => string;
  weekdays: string[];
  moreLabel: (n: number) => string;
}) {
  return (
    <div role="grid" aria-label="Calendar" className="overflow-hidden rounded-3xl bg-surface/90 ring-1 ring-line/60 shadow-[var(--shadow-lift)] backdrop-blur-sm">
      <div role="row" className="grid grid-cols-7 border-b border-line/60 bg-brand-50/50 text-center text-xs font-medium text-muted">
        {weekdays.map((d) => <div key={d} role="columnheader" className="py-2">{d}</div>)}
      </div>
      {weeks.map((week, wi) => (
        <div role="row" key={wi} className="grid grid-cols-7 border-b border-line last:border-b-0">
          {week.map((day) => {
            const chips = chipsFor(eventsByDate.get(day.iso) ?? []);
            const isSelected = day.iso === selected;
            return (
              <Link
                key={day.iso}
                role="gridcell"
                href={hrefFor(day.iso)}
                aria-selected={isSelected}
                aria-current={day.iso === today ? "date" : undefined}
                scroll={false}
                className={cx(
                  "flex min-h-20 flex-col gap-1 border-e border-line p-1.5 text-start last:border-e-0 hover:bg-canvas sm:min-h-28",
                  !day.inMonth && "bg-canvas/60 text-muted",
                  isSelected && "bg-brand-50/60 ring-2 ring-inset ring-brand-500",
                )}
              >
                <span className={cx("num grid size-6 place-items-center rounded-full text-xs", day.iso === today ? "bg-brand-600 font-semibold text-white" : "text-ink-soft")}>
                  {Number(day.iso.slice(8))}
                </span>
                {chips.slice(0, 3).map((c) => (
                  <span key={c.key} className={cx("truncate rounded-lg px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset", STATUS_TONE[c.status])}>
                    <bdi>{c.title}</bdi>{c.count > 1 ? ` · ${c.count}` : ""}
                  </span>
                ))}
                {chips.length > 3 && <span className="text-[11px] text-muted">{moreLabel(chips.length - 3)}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
