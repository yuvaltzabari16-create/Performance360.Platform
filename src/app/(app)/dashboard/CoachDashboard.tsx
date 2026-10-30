import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { formatMoneyTotals, summarize, type PaymentRow } from "@/lib/payments/ledger";
import { requireProfile } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";
import { bestTrial } from "@/lib/metrics";
import { isoDaysAgo } from "./dates";

// All figures below are counted from the database; nothing is estimated or seeded.
export async function CoachDashboard({ t, owner }: { t: Dictionary; owner: boolean }) {
  const { supabase, user, profile, org } = await requireProfile();
  const orgRole = org?.org_role ?? null;
  const td = t.dashboard;
  const today = isoDaysAgo(0);
  const [athletes, programs, tests30, sessions7, recentTests, upcoming] = await Promise.all([
    supabase.from("athletes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("training_programs").select("id", { count: "exact", head: true }).eq("coach_id", user.id).eq("status", "active"),
    supabase.from("test_results").select("id", { count: "exact", head: true }).gte("tested_on", isoDaysAgo(30)),
    supabase.from("workout_completions").select("id", { count: "exact", head: true }).gte("completed_on", isoDaysAgo(7)).neq("status", "skipped"),
    supabase.from("test_results").select("id, athlete_id, tested_on, side, trials, test_definitions(name, unit, higher_is_better), athletes(full_name)").order("created_at", { ascending: false }).limit(6),
    supabase.from("program_assignments").select("id, start_date, athletes(full_name), training_programs(title)").eq("status", "active").gte("start_date", today).order("start_date").limit(6),
  ]);

  // The owner's payments overview (the database returns no rows to anyone else).
  const { data: payments } = owner ? await supabase.from("athlete_payments").select("athlete_id, amount, currency, due_date, paid_on").limit(2000) : { data: null };
  const money = payments ? summarize(payments as PaymentRow[], today) : null;
  const athleteCount = athletes.count ?? 0;
  return (
    <>
      <PageHeader
        title={`${td.greeting}, ${profile.full_name.split(" ")[0] || profile.email}`}
        subtitle={org ? `${t.orgRoles[org.org_role]}${owner ? ` (${t.team.owner})` : ""} · ${org.org_name}` : t.roles[profile.role]}
        actions={
          <>
            <ButtonLink variant="secondary" href="/testing/new">{td.recordTest}</ButtonLink>
            <ButtonLink variant="secondary" href="/training/new">{td.newProgram}</ButtonLink>
            <ButtonLink href="/athletes/new">{td.addAthlete}</ButtonLink>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={td.activeAthletes} value={athleteCount} />
        <Stat label={td.activePrograms} value={programs.count ?? 0} />
        <Stat label={td.sessionsLogged} value={sessions7.count ?? 0} />
        <Stat label={td.testsThisMonth} value={tests30.count ?? 0} />
      </div>

      {money && (
        <div className="mt-6">
          <Card title={t.dashboard.paymentsCard} action={<Link className="text-xs text-brand-700 hover:underline" href="/payments">{t.common.open}</Link>}>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted">{t.payments.outstanding}</dt><dd className="num font-semibold">{formatMoneyTotals(money.outstanding, profile.locale)}</dd></div>
              <div>
                <dt className="text-xs text-muted">{t.payments.overdue}</dt>
                <dd className="num font-semibold">{money.overdueCount ? <Badge tone="red">{t.payments.overdueCount.replace("{n}", String(money.overdueCount))} · {formatMoneyTotals(money.overdue, profile.locale)}</Badge> : t.dashboard.overdueNone}</dd>
              </div>
              <div><dt className="text-xs text-muted">{t.payments.collected}</dt><dd className="num font-semibold">{formatMoneyTotals(money.collectedThisMonth, profile.locale)}</dd></div>
            </dl>
          </Card>
        </div>
      )}

      {athleteCount === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t.athletes.empty}
            body={td.emptyCoach}
            action={<div className="flex gap-2"><ButtonLink href="/athletes/new">{td.addAthlete}</ButtonLink>{orgRole && <ButtonLink variant="secondary" href="/team">{t.nav.team}</ButtonLink>}</div>}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={td.startingSoon} action={<Link className="text-xs text-brand-700 hover:underline" href="/calendar">{t.nav.calendar}</Link>}>
              {(upcoming.data ?? []).length === 0 ? <p className="text-sm text-muted">{td.nothingStarting}</p> : (
                <ul className="divide-y divide-line text-sm">
                  {(upcoming.data ?? []).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium"><bdi>{(a.training_programs as unknown as { title: string } | null)?.title}</bdi></div>
                        <div className="truncate text-xs text-muted"><bdi>{(a.athletes as unknown as { full_name: string } | null)?.full_name}</bdi></div>
                      </div>
                      <span className="num shrink-0 whitespace-nowrap text-xs text-muted">{a.start_date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title={t.nav.assistant} action={<Link className="text-xs text-brand-700 hover:underline" href="/assistant">{t.common.open}</Link>}>
              <p className="text-sm text-ink-soft">{td.assistantTeaser}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink variant="secondary" href="/training">{t.nav.training}</ButtonLink>
                <ButtonLink variant="secondary" href="/exercises">{t.nav.exercises}</ButtonLink>
                <ButtonLink href="/assistant">{t.nav.assistant}</ButtonLink>
              </div>
            </Card>
          </div>
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
