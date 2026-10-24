import { Card } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import { InjuryCard } from "./InjuryCard";
import { InjuryReportForm } from "./InjuryReportForm";
import type { InjuryEventRow, InjuryRow } from "./types";

interface Props {
  injuries: InjuryRow[];
  events: InjuryEventRow[];
  athleteId?: string;
  today: string;
  locale: string;
  t: Dictionary;
  back: string;
  professional: boolean;
  canClear: boolean;
  /** Whether to offer the form to log or report an injury (not for the read-only director view). */
  canReport?: boolean;
  /** Title override (the athlete's own page calls it "Report a problem" etc.). */
  title?: string;
}

/** Open injuries first, then a collapsed history, then the form to log a new one. */
export function InjurySection({ injuries, events, athleteId, today, locale, t, back, professional, canClear, canReport = true, title }: Props) {
  const ti = t.injury;
  const open = injuries.filter((i) => i.status === "open");
  const resolved = injuries.filter((i) => i.status === "resolved");
  const eventsFor = (id: string) => events.filter((e) => e.injury_id === id);
  const card = (i: InjuryRow) => (
    <InjuryCard key={i.id} injury={i} events={eventsFor(i.id)} today={today} locale={locale} t={t} back={back} professional={professional} canClear={canClear} />
  );

  return (
    <Card title={title ?? ti.sectionTitle}>
      <div id="injuries" />
      <div className="space-y-4">
        {injuries.length === 0 && <p className="text-sm text-muted">{ti.noInjuries}</p>}
        {open.map(card)}
        {resolved.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-ink">{ti.history} ({resolved.length})</summary>
            <div className="mt-3 space-y-4">{resolved.map(card)}</div>
          </details>
        )}
        {canReport && <details className="rounded-lg border border-line p-4" open={injuries.length === 0 ? false : undefined}>
          <summary className="cursor-pointer text-sm font-medium text-brand-700">{professional ? ti.log : ti.report}</summary>
          <div className="mt-3">
            {!professional && <p className="mb-3 text-sm text-muted">{ti.reportHelp}</p>}
            <InjuryReportForm athleteId={athleteId} back={back} professional={professional} t={t} />
          </div>
        </details>}
        <p className="text-xs text-muted">{ti.disclaimer}</p>
      </div>
    </Card>
  );
}
