import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, FlashMessage, PageHeader, Stat } from "@/components/ui";
import { getMyAthleteId, requireProfile } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";
import { bestTrial, readinessFlag, wellnessIndex } from "@/lib/metrics";
import type { ReadinessEntry, TrainingSession } from "@/lib/types";
import { round } from "@/lib/units";

export const metadata = { title: "Dashboard" };

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { profile, org, t } = await requireProfile();
  return (
    <>
      <FlashMessage ok={sp.ok} />
      {profile.role === "athlete" ? <AthleteDashboard t={t} /> : org?.org_role === "director" ? <DirectorDashboard t={t} /> : <CoachDashboard t={t} />}
    </>
  );
}

// The director sees the team's roster and aggregated totals, never individual athlete records.
async function DirectorDashboard({ t }: { t: Dictionary }) {
  const { supabase, profile, org } = await requireProfile();
  const tt = t.team;
  const [{ data: summaryRows }, { data: roster }, { data: members }] = await Promise.all([
    supabase.rpc("org_summary"),
    supabase.rpc("org_roster"),
    supabase.from("organization_members").select("user_id, org_role").eq("org_id", org!.org_id).eq("status", "active"),
  ]);
  const summary = (summaryRows as { staff_count: number; roster_count: number; roster_with_account: number; tests_30d: number; sessions_7d: number; readiness_today: number }[] | null)?.[0];
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const rosterRows = (roster ?? []) as { athlete_id: string; full_name: string; sport: string | null; position: string | null; has_account: boolean }[];
  const checkedIn = summary?.readiness_today ?? 0;
  const rosterCount = summary?.roster_count ?? 0;

  return (
    <>
      <PageHeader
        title={org!.org_name}
        subtitle={`${t.orgRoles.director} · ${profile.full_name}`}
        actions={<ButtonLink href="/team">{tt.title}</ButtonLink>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={tt.staffCount} value={summary?.staff_count ?? 0} />
        <Stat label={tt.rosterCount} value={rosterCount} />
        <Stat label={tt.tests30d} value={summary?.tests_30d ?? 0} />
        <Stat label={tt.sessions7d} value={summary?.sessions_7d ?? 0} />
        <Stat label={tt.readinessToday} value={`${checkedIn}${rosterCount ? ` / ${rosterCount}` : ""}`} />
      </div>
      <p className="mt-2 text-xs text-muted">{tt.aggregateNote}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={tt.staff} action={<Link className="text-xs text-brand-700 hover:underline" href="/team">{tt.inviteStaff}</Link>}>
          <ul className="divide-y divide-line text-sm">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between py-2.5">
                <span className="font-medium"><bdi>{people?.find((p) => p.id === m.user_id)?.full_name || "—"}</bdi></span>
                <Badge tone={m.org_role === "director" ? "green" : "blue"}>{t.orgRoles[m.org_role as keyof typeof t.orgRoles]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={tt.roster} action={<Link className="text-xs text-brand-700 hover:underline" href="/team">{t.common.view}</Link>}>
          {rosterRows.length === 0 ? <p className="text-sm text-muted">{tt.rosterEmpty}</p> : (
            <ul className="divide-y divide-line text-sm">
              {rosterRows.slice(0, 8).map((r) => (
                <li key={r.athlete_id} className="flex items-center justify-between py-2.5">
                  <span className="font-medium"><bdi>{r.full_name}</bdi></span>
                  <span className="text-xs text-muted"><bdi>{[r.sport, r.position].filter(Boolean).join(" · ")}</bdi></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

// All figures below are counted from the database; nothing is estimated or seeded.
async function CoachDashboard({ t }: { t: Dictionary }) {
  const { supabase, user, profile } = await requireProfile();
  const td = t.dashboard;
  const today = isoDaysAgo(0);
  const [athletes, programs, tests30, sessions7, readinessToday, recentTests, readinessRecent] = await Promise.all([
    supabase.from("athletes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("training_programs").select("id", { count: "exact", head: true }).eq("coach_id", user.id).eq("status", "active"),
    supabase.from("test_results").select("id", { count: "exact", head: true }).gte("tested_on", isoDaysAgo(30)),
    supabase.from("workout_completions").select("id", { count: "exact", head: true }).gte("completed_on", isoDaysAgo(7)).neq("status", "skipped"),
    supabase.from("readiness_entries").select("id", { count: "exact", head: true }).eq("entry_date", today),
    supabase.from("test_results").select("id, athlete_id, tested_on, side, trials, test_definitions(name, unit, higher_is_better), athletes(full_name)").order("created_at", { ascending: false }).limit(6),
    supabase.from("readiness_entries").select("*, athletes(full_name)").gte("entry_date", isoDaysAgo(21)).order("entry_date", { ascending: false }).limit(3000),
  ]);

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
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
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

async function AthleteDashboard({ t }: { t: Dictionary }) {
  const { supabase, profile } = await requireProfile();
  const td = t.dashboard;
  const athleteId = await getMyAthleteId();
  const today = isoDaysAgo(0);

  if (!athleteId) {
    return (
      <>
        <PageHeader title={`${td.greeting}, ${profile.full_name.split(" ")[0] || ""}`} />
        <div className="grid gap-6 lg:grid-cols-2">
          <EmptyState title={td.notConnected} action={<ButtonLink href="/connect">{td.connectCta}</ButtonLink>} />
          <Card title={td.checkInToday}>
            <p className="mb-3 text-sm text-ink-soft">{t.readiness.needsProfile}</p>
            <ButtonLink href="/readiness">{td.checkInCta}</ButtonLink>
          </Card>
        </div>
      </>
    );
  }

  const [{ data: me }, { data: assignments }, { data: todayEntry }, { data: completions }, { data: notes }, { data: tests }, { data: rels }] = await Promise.all([
    supabase.from("athletes").select("short_term_goals, long_term_goals").eq("id", athleteId).single(),
    supabase.from("program_assignments").select("program_id, training_programs(title)").eq("athlete_id", athleteId).eq("status", "active"),
    supabase.from("readiness_entries").select("id").eq("athlete_id", athleteId).eq("entry_date", today).maybeSingle(),
    supabase.from("workout_completions").select("session_id, status").eq("athlete_id", athleteId),
    supabase.from("athlete_notes").select("id, body, created_at").eq("athlete_id", athleteId).eq("shared_with_athlete", true).order("created_at", { ascending: false }).limit(3),
    supabase.from("test_results").select("id, tested_on, side, trials, test_definitions(name, unit, higher_is_better)").eq("athlete_id", athleteId).order("tested_on", { ascending: false }).limit(5),
    supabase.from("coach_athlete_relationships").select("id").eq("athlete_id", athleteId).eq("status", "active"),
  ]);
  const programIds = (assignments ?? []).map((a) => a.program_id);
  const { data: sessions } = programIds.length
    ? await supabase.from("training_sessions").select("*").in("program_id", programIds).order("week_number").order("day_number").limit(200)
    : { data: [] };
  const done = new Set((completions ?? []).filter((c) => c.status !== "skipped").map((c) => c.session_id));
  const upcoming = ((sessions ?? []) as TrainingSession[]).filter((s) => !done.has(s.id)).slice(0, 5);

  return (
    <>
      <PageHeader title={`${td.greeting}, ${profile.full_name.split(" ")[0] || ""}`} actions={<ButtonLink variant="secondary" href={`/athletes/${athleteId}`}>{t.athletes.myProfile}</ButtonLink>} />
      {(rels ?? []).length === 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-brand-900">
          {td.notConnected}
          <ButtonLink href="/connect">{td.connectCta}</ButtonLink>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={td.todaySession} className="lg:col-span-2" action={<Link className="text-xs text-brand-700 hover:underline" href="/training">{t.nav.myTraining}</Link>}>
          {upcoming.length === 0 ? <p className="text-sm text-muted">{td.noAssigned}</p> : (
            <ul className="divide-y divide-line">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted">{((assignments ?? []).find((a) => a.program_id === s.program_id)?.training_programs as unknown as { title: string } | null)?.title} · {t.common.week} {s.week_number} · {t.common.day} {s.day_number}</div>
                  </div>
                  <ButtonLink className="px-2.5 py-1 text-xs" href={`/training/session/${s.id}?athlete=${athleteId}`}>{t.training.log}</ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={td.checkInToday}>
          {todayEntry ? <p className="text-sm text-brand-800">✓ {td.checkInDone}</p> : <ButtonLink href="/readiness">{td.checkInCta}</ButtonLink>}
        </Card>
        <Card title={td.myGoals}>
          {!me?.short_term_goals && !me?.long_term_goals ? <p className="text-sm text-muted">{td.noGoals}</p> : (
            <div className="space-y-3 text-sm">
              {me?.short_term_goals && <div><div className="text-xs text-muted">{t.athletes.shortGoals}</div><p className="whitespace-pre-line">{me.short_term_goals}</p></div>}
              {me?.long_term_goals && <div><div className="text-xs text-muted">{t.athletes.longGoals}</div><p className="whitespace-pre-line">{me.long_term_goals}</p></div>}
            </div>
          )}
        </Card>
        <Card title={t.testing.recent} action={<Link className="text-xs text-brand-700 hover:underline" href="/testing">{t.nav.myResults}</Link>}>
          {(tests ?? []).length === 0 ? <p className="text-sm text-muted">{t.testing.empty}</p> : (
            <ul className="space-y-2 text-sm">
              {(tests ?? []).map((r) => {
                const def = r.test_definitions as unknown as { name: string; unit: string; higher_is_better: boolean };
                return (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="min-w-0"><bdi>{def.name}</bdi><span className="text-xs text-muted">{r.side !== "both" && ` · ${t.testing.sides[r.side as "left" | "right"]}`} · <span className="num whitespace-nowrap">{r.tested_on}</span></span></span>
                    <span className="num shrink-0 whitespace-nowrap font-medium">{bestTrial(r.trials as number[], def.higher_is_better)} {def.unit}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title={td.coachFeedback}>
          {(notes ?? []).length === 0 ? <p className="text-sm text-muted">{td.noFeedback}</p> : (
            <ul className="space-y-3 text-sm">
              {(notes ?? []).map((n) => (
                <li key={n.id}>
                  <p className="whitespace-pre-line">{n.body}</p>
                  <div className="num text-xs text-muted">{new Date(n.created_at).toLocaleDateString(profile.locale)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
