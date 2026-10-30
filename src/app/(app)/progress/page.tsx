import Link from "next/link";
import { BarsChart } from "@/components/charts/BarsChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { ButtonLink, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { getMyAthleteId, requireSection } from "@/lib/auth";
import { bestTrial, summarizeResults, type ResultPoint } from "@/lib/metrics";
import { weeklyTraining, workoutStats, type CompletionRow } from "@/lib/progress";
import { round } from "@/lib/units";

export const metadata = { title: "My Progress" };

/** The athlete's own progress: workouts logged over time and each test's trend. Only their own rows are read. */
export default async function ProgressPage() {
  const { supabase, t } = await requireSection("progress");
  const tp = t.progress;
  const athleteId = await getMyAthleteId();
  const header = <PageHeader title={tp.title} subtitle={tp.subtitle} />;
  if (!athleteId) return <>{header}<EmptyState title={t.dashboard.notConnected} action={<ButtonLink href="/connect">{t.dashboard.connectCta}</ButtonLink>} /></>;

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: completions }, { data: results }, { data: me }] = await Promise.all([
    supabase.from("workout_completions").select("completed_on, status, session_rpe, duration_min").eq("athlete_id", athleteId).order("completed_on").limit(2000),
    supabase.from("test_results").select("test_id, tested_on, side, trials, is_baseline, method, test_definitions(name, unit, higher_is_better)").eq("athlete_id", athleteId).order("tested_on").limit(1000),
    supabase.from("athletes").select("short_term_goals, long_term_goals").eq("id", athleteId).single(),
  ]);
  const rows = (completions ?? []) as CompletionRow[];
  const stats = workoutStats(rows, today);
  const weeks = weeklyTraining(rows, today);

  // One trend per test and side, the most-tested first.
  type Def = { name: string; unit: string; higher_is_better: boolean };
  const groups = new Map<string, { def: Def; side: string; points: ResultPoint[] }>();
  for (const r of (results ?? []) as unknown as (ResultPoint & { test_id: string; test_definitions: Def })[]) {
    const key = `${r.test_id}:${r.side}`;
    const g = groups.get(key) ?? { def: r.test_definitions, side: r.side, points: [] };
    g.points.push(r);
    groups.set(key, g);
  }
  const tests = [...groups.entries()].sort((a, b) => b[1].points.length - a[1].points.length).slice(0, 8);
  const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${round(v, 1)}%`);

  return (
    <>
      {header}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tp.done30} value={stats.done30} />
        <Stat label={tp.doneAll} value={stats.doneAll} />
        <Stat label={tp.completionRate} value={stats.completionRate30 == null ? "—" : `${stats.completionRate30}%`} />
        <Stat label={tp.avgRpe} value={stats.avgRpe30 ?? "—"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={tp.weekly}>
          {stats.doneAll === 0 ? <p className="text-sm text-muted">{tp.noWorkouts}</p> : <BarsChart data={weeks} dataKey="workouts" label={tp.weekly} />}
        </Card>
        <Card title={tp.weeklyLoad}>
          {stats.doneAll === 0 ? <p className="text-sm text-muted">{tp.noWorkouts}</p> : (
            <>
              <BarsChart data={weeks} dataKey="load" label={tp.weeklyLoad} />
              <p className="mt-2 text-xs text-muted">{tp.loadHelp}</p>
            </>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
        {tp.tests}
        <Link href="/testing" className="normal-case tracking-normal text-brand-700 hover:underline">{tp.allResults}</Link>
      </h2>
      {tests.length === 0 ? <p className="text-sm text-muted">{tp.noTests}</p> : (
        <div className="grid gap-6 lg:grid-cols-2">
          {tests.map(([key, g]) => {
            const s = summarizeResults(g.points, g.def.higher_is_better);
            const data = [...g.points].sort((a, b) => a.tested_on.localeCompare(b.tested_on)).map((p) => ({ date: p.tested_on.slice(5), best: bestTrial(p.trials, g.def.higher_is_better) }));
            return (
              <Card key={key} title={<bdi>{g.def.name}{g.side !== "both" ? ` · ${t.testing.sides[g.side as "left" | "right"]}` : ""}</bdi>}>
                <dl className="mb-3 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-muted">{tp.latest}</dt><dd className="num font-semibold">{s.latest ?? "—"} {g.def.unit}</dd></div>
                  <div><dt className="text-xs text-muted">{tp.best}</dt><dd className="num font-semibold">{s.personalBest ?? "—"} {g.def.unit}</dd></div>
                  <div><dt className="text-xs text-muted">{tp.sinceFirst}</dt><dd className="num font-semibold">{pct(s.changeFromBaselinePct)}</dd></div>
                </dl>
                {data.length > 1 && <TrendChart data={data} series={[{ key: "best", label: g.def.name, color: "#23985e" }]} unit={g.def.unit} height={160} reversed={!g.def.higher_is_better} />}
              </Card>
            );
          })}
        </div>
      )}

      {(me?.short_term_goals || me?.long_term_goals) && (
        <Card title={tp.goals} className="mt-8">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            {me?.short_term_goals && <div><div className="text-xs text-muted">{t.athletes.shortGoals}</div><p className="whitespace-pre-line"><bdi>{me.short_term_goals}</bdi></p></div>}
            {me?.long_term_goals && <div><div className="text-xs text-muted">{t.athletes.longGoals}</div><p className="whitespace-pre-line"><bdi>{me.long_term_goals}</bdi></p></div>}
          </div>
        </Card>
      )}
    </>
  );
}
