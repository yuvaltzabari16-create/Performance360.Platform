import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, FlashMessage, PageHeader, Table, Td } from "@/components/ui";
import { AutoSubmitSelect, ConfirmSubmit } from "@/components/ui/client";
import { TrendChart } from "@/components/charts/TrendChart";
import { getMyAthleteId, requireProfile } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { bestTrial, isImprovement, limbDifference, meanTrial, summarizeResults } from "@/lib/metrics";
import type { TestDefinition, TestResult } from "@/lib/types";
import { round } from "@/lib/units";
import { deleteResult } from "./actions";

export const metadata = { title: "Testing" };

function fmtPct(v: number | null) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${round(v, 1)}%`;
}

export default async function TestingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, profile, t } = await requireProfile();
  const tt = t.testing;
  const isAthlete = profile.role === "athlete";

  const myId = isAthlete ? await getMyAthleteId() : null;
  const { data: athletes } = isAthlete
    ? { data: [] as { id: string; full_name: string }[] }
    : await supabase.from("athletes").select("id, full_name").eq("status", "active").order("full_name").limit(500);
  const athleteId = isAthlete ? myId : isUuid(sp.athlete) ? sp.athlete : null;

  // Without a selected athlete, professionals see recent results across their roster.
  if (!athleteId) {
    const { data: recent } = isAthlete
      ? { data: [] }
      : await supabase
          .from("test_results")
          .select("id, athlete_id, tested_on, side, trials, method, test_definitions(name, unit, higher_is_better), athletes(full_name)")
          .order("tested_on", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(30);
    return (
      <>
        <PageHeader
          title={isAthlete ? tt.myTitle : tt.title}
          actions={!isAthlete && (
            <>
              <ButtonLink variant="secondary" href="/testing/batteries">{tt.batteries}</ButtonLink>
              <ButtonLink href="/testing/new">{tt.record}</ButtonLink>
            </>
          )}
        />
        <FlashMessage error={sp.error} ok={sp.ok} />
        {!isAthlete && (
          <form action="/testing" className="mb-5 max-w-sm">
            <AutoSubmitSelect name="athlete" defaultValue="" aria-label={tt.athlete}>
              <option value="">{tt.filterAthlete}</option>
              {(athletes ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </AutoSubmitSelect>
          </form>
        )}
        {(recent ?? []).length === 0 ? (
          <EmptyState title={tt.empty} body={isAthlete ? t.readiness.needsProfile : tt.emptyHelp} action={!isAthlete && <ButtonLink href="/testing/new">{tt.record}</ButtonLink>} />
        ) : (
          <Table head={[t.common.date, tt.athlete, tt.test, tt.best, tt.method]}>
            {(recent ?? []).map((r) => {
              const def = r.test_definitions as unknown as { name: string; unit: string; higher_is_better: boolean };
              return (
                <tr key={r.id}>
                  <Td><span className="num">{r.tested_on}</span></Td>
                  <Td><Link href={`/testing?athlete=${r.athlete_id}`} className="font-medium hover:text-brand-700">{(r.athletes as unknown as { full_name: string }).full_name}</Link></Td>
                  <Td><bdi>{def.name}</bdi>{r.side !== "both" && ` · ${tt.sides[r.side as "left" | "right"]}`}</Td>
                  <Td><span className="num font-medium">{bestTrial(r.trials as number[], def.higher_is_better)} {def.unit}</span></Td>
                  <Td className="text-ink-soft">{r.method ?? "—"}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </>
    );
  }

  const [{ data: athlete }, { data: resultsData }] = await Promise.all([
    supabase.from("athletes").select("id, full_name").eq("id", athleteId).maybeSingle(),
    supabase.from("test_results").select("*").eq("athlete_id", athleteId).order("tested_on").limit(1000),
  ]);
  const results = (resultsData ?? []) as TestResult[];
  const testIds = [...new Set(results.map((r) => r.test_id))];
  const { data: defsData } = testIds.length ? await supabase.from("test_definitions").select("*").in("id", testIds) : { data: [] };
  const defs = new Map(((defsData ?? []) as TestDefinition[]).map((d) => [d.id, d]));
  const selectedTest = isUuid(sp.test) && defs.has(sp.test) ? sp.test : null;

  // Group by test, then side.
  const groups = [...defs.values()]
    .filter((d) => !selectedTest || d.id === selectedTest)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .map((def) => {
      const rows = results.filter((r) => r.test_id === def.id);
      const sides = (["both", "left", "right"] as const).filter((s) => rows.some((r) => r.side === s));
      const bySide = sides.map((side) => ({ side, summary: summarizeResults(rows.filter((r) => r.side === side), def.higher_is_better) }));
      const left = bySide.find((s) => s.side === "left")?.summary.latest ?? null;
      const right = bySide.find((s) => s.side === "right")?.summary.latest ?? null;
      const dates = [...new Set(rows.map((r) => r.tested_on))].sort();
      const chart = dates.map((date) => {
        const point: Record<string, string | number | null> = { date };
        for (const side of sides) {
          const sameDay = rows.filter((r) => r.tested_on === date && r.side === side).map((r) => bestTrial(r.trials, def.higher_is_better)).filter((v): v is number => v != null);
          point[side] = sameDay.length ? (def.higher_is_better ? Math.max(...sameDay) : Math.min(...sameDay)) : null;
        }
        return point;
      });
      return { def, rows, bySide, limbDiff: limbDifference(left, right, def.higher_is_better), chart, sides };
    });

  const sideColors = { both: "#23985e", left: "#2563eb", right: "#d97706" };

  return (
    <>
      <PageHeader
        title={isAthlete ? tt.myTitle : `${tt.title}: ${athlete?.full_name ?? ""}`}
        crumbs={isAthlete ? [] : [{ href: "/testing", label: tt.title }, { href: `/athletes/${athleteId}`, label: athlete?.full_name ?? "" }]}
        actions={
          <>
            {results.length > 0 && <ButtonLink variant="secondary" href={`/testing/export?athlete=${athleteId}`}>{t.common.exportCsv}</ButtonLink>}
            {!isAthlete && <ButtonLink href={`/testing/new?athlete=${athleteId}`}>{tt.record}</ButtonLink>}
          </>
        }
      />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <form action="/testing" className="mb-5 grid max-w-xl gap-2 sm:grid-cols-2">
        {!isAthlete ? (
          <AutoSubmitSelect name="athlete" defaultValue={athleteId} aria-label={tt.athlete}>
            <option value="">{tt.filterAthlete}</option>
            {(athletes ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </AutoSubmitSelect>
        ) : <input type="hidden" name="athlete" value={athleteId} />}
        {defs.size > 1 && (
          <AutoSubmitSelect name="test" defaultValue={selectedTest ?? ""} aria-label={tt.test}>
            <option value="">{tt.test}: {t.common.all}</option>
            {[...defs.values()].map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </AutoSubmitSelect>
        )}
      </form>
      <p className="mb-5 text-xs text-muted">{tt.bestRule} {tt.measuredVsCalc} {tt.noNorms}</p>

      {groups.length === 0 ? (
        <EmptyState title={tt.empty} body={tt.emptyHelp} />
      ) : (
        <div className="space-y-6">
          {groups.map(({ def, rows, bySide, limbDiff, chart, sides }) => (
            <Card key={def.id} title={<span>{def.name} <span className="font-normal text-muted">({def.unit}, {def.higher_is_better ? "↑" : "↓"})</span></span>}>
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="space-y-3 lg:col-span-2">
                  {bySide.map(({ side, summary: s }) => (
                    <div key={side} className="rounded-lg bg-canvas p-3">
                      {sides.length > 1 || side !== "both" ? <div className="mb-2 text-xs font-medium text-ink-soft">{tt.sides[side]}</div> : null}
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div><dt className="text-xs text-muted">{tt.latest}</dt><dd className="num font-semibold">{s.latest ?? "—"}</dd></div>
                        <div><dt className="text-xs text-muted">{tt.pb}</dt><dd className="num font-semibold">{s.personalBest ?? "—"}</dd></div>
                        <div>
                          <dt className="text-xs text-muted">{tt.fromPrevious}</dt>
                          <dd className={`num ${isImprovement(s.latest != null && s.previous != null ? s.latest - s.previous : null, def.higher_is_better) ? "text-brand-700" : ""}`}>{fmtPct(s.changeFromPreviousPct)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted">{tt.fromBaseline}</dt>
                          <dd className={`num ${isImprovement(s.latest != null && s.baseline != null ? s.latest - s.baseline : null, def.higher_is_better) ? "text-brand-700" : ""}`}>{fmtPct(s.changeFromBaselinePct)}</dd>
                        </div>
                      </dl>
                      {s.methods.length > 1 && <p className="mt-2 text-xs text-amber-800">{tt.methodsMixed} {s.methods.join(", ")}</p>}
                    </div>
                  ))}
                  {limbDiff != null && (
                    <div className="rounded-lg border border-line p-3 text-sm">
                      <span className="text-xs text-muted">{tt.limbDiff}: </span>
                      <span className="num font-semibold">{round(limbDiff, 1)}%</span>
                    </div>
                  )}
                </div>
                <div className="lg:col-span-3">
                  <TrendChart
                    data={chart}
                    unit={def.unit}
                    reversed={!def.higher_is_better}
                    series={sides.map((s) => ({ key: s, label: tt.sides[s], color: sideColors[s] }))}
                  />
                </div>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-brand-700">{tt.history} ({rows.length})</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs text-muted">
                      <tr><th className="py-1 text-start font-medium">{t.common.date}</th><th className="text-start font-medium">{tt.side}</th><th className="text-start font-medium">{tt.trials}</th><th className="text-start font-medium">{tt.best}</th><th className="text-start font-medium">{tt.mean}</th><th className="text-start font-medium">{tt.method}</th><th /></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {[...rows].reverse().map((r) => (
                        <tr key={r.id}>
                          <td className="num py-1.5">{r.tested_on} {r.is_baseline && <Badge tone="blue">{tt.baselineShort}</Badge>}</td>
                          <td>{tt.sides[r.side]}</td>
                          <td className="num text-ink-soft">{r.trials.join(" / ")}</td>
                          <td className="num font-medium">{bestTrial(r.trials, def.higher_is_better)}</td>
                          <td className="num">{r.trials.length > 1 ? round(meanTrial(r.trials)!, 3) : "—"}</td>
                          <td className="text-ink-soft">
                            {r.method ?? "—"}
                            {r.data_quality !== "good" && <> <Badge tone="amber">{tt.qualities[r.data_quality]}</Badge></>}
                          </td>
                          <td className="text-end">
                            {r.tester_id === user.id && (
                              <form action={deleteResult}>
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="athlete_id" value={athleteId} />
                                <ConfirmSubmit variant="ghost" className="px-2 py-0.5 text-xs text-red-700" message={`${t.common.delete}?`}>{t.common.delete}</ConfirmSubmit>
                              </form>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
