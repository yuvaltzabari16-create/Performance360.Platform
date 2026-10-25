import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";
import { bestTrial, readinessFlag, wellnessIndex } from "@/lib/metrics";
import type { ReadinessEntry } from "@/lib/types";
import { round } from "@/lib/units";
import { OpenInjuriesCard, type OpenInjury } from "@/components/injury/OpenInjuriesCard";
import { AlertsCard } from "@/components/dashboard/AlertsCard";
import { staffAlerts } from "@/lib/alerts";
import { isoDaysAgo } from "./dates";

// All figures below are counted from the database; nothing is estimated or seeded.
export async function CoachDashboard({ t }: { t: Dictionary }) {
  const { supabase, user, profile } = await requireProfile();
  const td = t.dashboard;
  const today = isoDaysAgo(0);
  const [athletes, programs, tests30, sessions7, readinessToday, recentTests, readinessRecent, injuries] = await Promise.all([
    supabase.from("athletes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("training_programs").select("id", { count: "exact", head: true }).eq("coach_id", user.id).eq("status", "active"),
    supabase.from("test_results").select("id", { count: "exact", head: true }).gte("tested_on", isoDaysAgo(30)),
    supabase.from("workout_completions").select("id", { count: "exact", head: true }).gte("completed_on", isoDaysAgo(7)).neq("status", "skipped"),
    supabase.from("readiness_entries").select("id", { count: "exact", head: true }).eq("entry_date", today),
    supabase.from("test_results").select("id, athlete_id, tested_on, side, trials, test_definitions(name, unit, higher_is_better), athletes(full_name)").order("created_at", { ascending: false }).limit(6),
    supabase.from("readiness_entries").select("*, athletes(full_name)").gte("entry_date", isoDaysAgo(21)).order("entry_date", { ascending: false }).limit(3000),
    supabase.from("injuries").select("id, athlete_id, body_area, stage, injury_date, athletes(full_name)").eq("status", "open").order("injury_date", { ascending: true }).limit(6),
  ]);

  // Alerts come from rows the database lets this person read: squad-scoped, and wearables only when shared.
  const [{ data: loadRows }, { data: dailyRows }] = await Promise.all([
    supabase.from("gps_session_metrics").select("athlete_id, player_load, total_distance_m, gps_sessions!inner(session_date)").gte("gps_sessions.session_date", isoDaysAgo(40)).limit(3000),
    supabase.from("wearable_daily").select("athlete_id, day, recovery_score").gte("day", isoDaysAgo(3)).limit(1000),
  ]);
  const alerts = staffAlerts(
    ((loadRows ?? []) as unknown as { athlete_id: string; player_load: number | null; total_distance_m: number; gps_sessions: { session_date: string } | { session_date: string }[] }[]).map((r) => ({
      athleteId: r.athlete_id,
      date: (Array.isArray(r.gps_sessions) ? r.gps_sessions[0] : r.gps_sessions).session_date,
      load: Number(r.player_load) || r.total_distance_m / 100,
    })),
    ((dailyRows ?? []) as { athlete_id: string; day: string; recovery_score: number | null }[]).map((r) => ({ athleteId: r.athlete_id, day: r.day, recovery: r.recovery_score === null ? null : Number(r.recovery_score) })),
    today,
  );
  const alertIds = [...new Set(alerts.map((a) => a.athleteId))];
  const { data: alertNames } = alertIds.length ? await supabase.from("athletes").select("id, full_name").in("id", alertIds) : { data: [] };
  const alertNameMap = new Map((alertNames ?? []).map((a) => [a.id as string, a.full_name as string]));

  const entries = (readinessRecent.data ?? []) as (ReadinessEntry & { athletes: { full_name: string } })[];
  const byAthlete = new Map<string, typeof entries>();
  entries.forEach((e) => byAthlete.set(e.athlete_id, [...(byAthlete.get(e.athlete_id) ?? []), e]));
  const flagged = entries
    .filter((e) => e.entry_date === today)
    .filter((e) => {
      const prior = (byAthlete.get(e.athlete_id) ?? []).filter((h) => h.entry_date < e.entry_date).map((h) => wellnessIndex(h));
      return e.pain_reported || readinessFlag(wellnessIndex(e), prior);
    });

  const athleteCount = athletes.count ?? 0;
  return (
    <>
      <PageHeader
        title={`${td.greeting}, ${profile.full_name.split(" ")[0] || profile.email}`}
        subtitle={t.roles[profile.role]}
        actions={
          <>
            <ButtonLink variant="secondary" href="/testing/new">{td.recordTest}</ButtonLink>
            <ButtonLink variant="secondary" href="/training/new">{td.newProgram}</ButtonLink>
            <ButtonLink href="/athletes/new">{td.addAthlete}</ButtonLink>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={td.activeAthletes} value={athleteCount} />
        <Stat label={td.activePrograms} value={programs.count ?? 0} />
        <Stat label={td.sessionsLogged} value={sessions7.count ?? 0} />
        <Stat label={td.testsThisMonth} value={tests30.count ?? 0} />
        <Stat label={td.readinessToday} value={`${readinessToday.count ?? 0}${athleteCount ? ` / ${athleteCount}` : ""}`} />
      </div>

      {athleteCount === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t.athletes.empty}
            body={td.emptyCoach}
            action={<div className="flex gap-2"><ButtonLink href="/athletes/new">{td.addAthlete}</ButtonLink><ButtonLink variant="secondary" href="/code">{t.nav.code}</ButtonLink></div>}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{td.needsAttention}</h2>
          <div className="grid gap-6 lg:grid-cols-2">
          <Card title={td.readinessReview} action={<Link className="text-xs text-brand-700 hover:underline" href="/readiness">{t.readiness.title}</Link>}>
            {flagged.length === 0 ? <p className="text-sm text-muted">{td.noFlags}</p> : (
              <ul className="divide-y divide-line text-sm">
                {flagged.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <Link href={`/athletes/${e.athlete_id}`} className="font-medium hover:text-brand-700">{e.athletes.full_name}</Link>
                    <span className="flex items-center gap-2">
                      <span className="num text-xs text-muted">{wellnessIndex(e) == null ? "—" : round(wellnessIndex(e)!, 1)}</span>
                      <Badge tone="amber">{t.readiness.flagged}{e.pain_reported ? " · ⚠" : ""}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">{t.readiness.flagHelp}</p>
          </Card>
          <OpenInjuriesCard injuries={(injuries.data ?? []) as unknown as OpenInjury[]} today={today} t={t} href="/injuries" showAthlete />
          </div>
          <AlertsCard alerts={alerts} names={alertNameMap} t={t} />
          <Card title={td.recentTests} action={<Link className="text-xs text-brand-700 hover:underline" href="/testing">{t.testing.title}</Link>}>
            {(recentTests.data ?? []).length === 0 ? <p className="text-sm text-muted">{t.testing.empty}</p> : (
              <ul className="divide-y divide-line text-sm">
                {(recentTests.data ?? []).map((r) => {
                  const def = r.test_definitions as unknown as { name: string; unit: string; higher_is_better: boolean };
                  return (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <div>
                        <Link href={`/testing?athlete=${r.athlete_id}`} className="font-medium hover:text-brand-700">{(r.athletes as unknown as { full_name: string }).full_name}</Link>
                        <div className="text-xs text-muted"><bdi>{def.name}</bdi>{r.side !== "both" && ` · ${t.testing.sides[r.side as "left" | "right"]}`} · <span className="num whitespace-nowrap">{r.tested_on}</span></div>
                      </div>
                      <span className="num shrink-0 whitespace-nowrap font-medium">{bestTrial(r.trials as number[], def.higher_is_better)} {def.unit}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
