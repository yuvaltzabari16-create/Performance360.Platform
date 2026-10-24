import Link from "next/link";
import { Badge, EmptyState, FlashMessage, PageHeader, Stat } from "@/components/ui";
import { InjurySection } from "@/components/injury/InjurySection";
import type { InjuryRow } from "@/components/injury/types";
import { requireProfile } from "@/lib/auth";
import { INJURY_STAGES, daysOut, returnOutlook } from "@/lib/injury";
import { loadInjuries } from "@/lib/injury-data";

export default async function InjuriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile, user, t } = await requireProfile();
  const today = new Date().toISOString().slice(0, 10);
  const ti = t.injury;

  // Athletes: their own injuries and a way to report one.
  if (profile.role === "athlete") {
    const { data: mine } = await supabase.from("athletes").select("id").eq("user_id", user.id).maybeSingle();
    const { injuries, events, files: injuryFiles } = await loadInjuries(supabase, mine ? [mine.id] : []);
    return (
      <>
        <PageHeader title={ti.title} subtitle={ti.subtitle} />
        <FlashMessage error={sp.error} ok={sp.ok} />
        <InjurySection injuries={injuries} events={events} files={injuryFiles} userId={user.id} athleteId={mine?.id} today={today} locale={profile.locale} t={t} back="/injuries" professional={false} canClear={false} title={ti.report} />
      </>
    );
  }

  // Staff: every injury on the athletes they can see, as a board by stage.
  const { data: athletes } = await supabase.from("athletes").select("id, full_name").limit(500);
  const names = new Map((athletes ?? []).map((a) => [a.id as string, a.full_name as string]));
  const { injuries } = await loadInjuries(supabase, [...names.keys()]);
  const open = injuries.filter((i) => i.status === "open");
  const resolved = injuries.filter((i) => i.status === "resolved");
  const soon = open.filter((i) => {
    const o = returnOutlook(i.expected_return, today);
    return o.kind === "today" || (o.kind === "ahead" && o.days <= 7);
  }).length;
  const avgOut = resolved.length ? Math.round(resolved.reduce((sum, i) => sum + daysOut(i.injury_date, today, i.resolved_on), 0) / resolved.length) : null;
  const boardStages = INJURY_STAGES.filter((s) => s !== "cleared");
  const byStage = (stage: string): InjuryRow[] => open.filter((i) => i.stage === stage);

  return (
    <>
      <PageHeader title={ti.boardTitle} subtitle={ti.boardSubtitle} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={ti.kpiOpen} value={open.length} />
        <Stat label={ti.kpiSoon} value={soon} />
        <Stat label={ti.kpiAvg} value={avgOut ?? "—"} />
      </div>
      {open.length === 0 ? (
        <EmptyState title={ti.boardEmpty} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5" data-testid="injury-board">
          {boardStages.map((stage) => (
            <section key={stage} aria-label={ti.stages[stage]} className="rounded-xl border border-line bg-canvas p-3">
              <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-ink">
                {ti.stages[stage]}
                <Badge>{byStage(stage).length}</Badge>
              </h2>
              <ul className="space-y-2">
                {byStage(stage).length === 0 && <li className="text-xs text-muted">{ti.columnEmpty}</li>}
                {byStage(stage).map((i) => (
                  <li key={i.id}>
                    <Link href={`/athletes/${i.athlete_id}#injury-${i.id}`} className="block rounded-lg border border-line bg-surface p-3 text-sm hover:border-brand-300">
                      <div className="font-medium text-ink"><bdi>{names.get(i.athlete_id) ?? "—"}</bdi></div>
                      <div className="text-xs text-muted">{ti.areas[i.body_area as keyof typeof ti.areas]} · {ti.daysOut.replace("{n}", String(daysOut(i.injury_date, today)))}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
