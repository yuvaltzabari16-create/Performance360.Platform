import Link from "next/link";
import { Badge, ButtonLink, Card, PageHeader, Stat } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatMoneyTotals, summarize, type PaymentRow } from "@/lib/payments/ledger";
import type { Dictionary } from "@/lib/i18n";

// The director sees the academy's roster and aggregated totals, never individual athlete records.
export async function DirectorDashboard({ t }: { t: Dictionary }) {
  const { supabase, profile, org } = await requireProfile();
  const tt = t.team;
  const [{ data: summaryRows }, { data: roster }, { data: members }, { data: payments }] = await Promise.all([
    supabase.rpc("org_summary"),
    supabase.rpc("org_roster"),
    supabase.from("organization_members").select("user_id, org_role").eq("org_id", org!.org_id).eq("status", "active"),
    supabase.from("athlete_payments").select("athlete_id, amount, currency, due_date, paid_on").limit(2000),
  ]);
  const summary = (summaryRows as { staff_count: number; roster_count: number; roster_with_account: number; tests_30d: number; sessions_7d: number; readiness_today: number }[] | null)?.[0];
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const rosterRows = (roster ?? []) as { athlete_id: string; full_name: string; sport: string | null; position: string | null; has_account: boolean }[];
  const rosterCount = summary?.roster_count ?? 0;
  const money = summarize((payments ?? []) as PaymentRow[], new Date().toISOString().slice(0, 10));

  return (
    <>
      <PageHeader
        title={org!.org_name}
        subtitle={`${t.orgRoles.director} · ${profile.full_name}`}
        actions={<><ButtonLink variant="secondary" href="/calendar">{t.nav.calendar}</ButtonLink><ButtonLink href="/team">{t.nav.team}</ButtonLink></>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tt.staffCount} value={summary?.staff_count ?? 0} />
        <Stat label={tt.rosterCount} value={rosterCount} />
        <Stat label={tt.tests30d} value={summary?.tests_30d ?? 0} />
        <Stat label={tt.sessions7d} value={summary?.sessions_7d ?? 0} />
      </div>
      <p className="mt-2 text-xs text-muted">{tt.aggregateNote}</p>
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
