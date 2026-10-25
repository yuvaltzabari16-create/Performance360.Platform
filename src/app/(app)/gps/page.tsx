import Link from "next/link";
import { ConnectionsCard } from "@/components/gps/ConnectionsCard";
import { TrendChart } from "@/components/charts/TrendChart";
import { Badge, ButtonLink, Card, EmptyState, FlashMessage, PageHeader, Stat } from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui/client";
import { requireSection } from "@/lib/auth";
import { average, formatDistance, type GpsMetricRow, type GpsSessionRow } from "@/lib/gps/format";
import { workloads } from "@/lib/gps/workload";
import { canImportGps } from "@/lib/permissions";
import { loadSampleSession } from "./actions";

export const metadata = { title: "GPS" };

export default async function GpsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile, org, t } = await requireSection("gps");
  const tg = t.gps;
  const isAthlete = profile.role === "athlete";
  const canImport = !isAthlete && canImportGps(org?.org_role ?? null);
  const kind = sp.kind === "match" || sp.kind === "training" ? sp.kind : null;

  let query = supabase.from("gps_sessions").select("id, title, kind, session_date, duration_min, source, is_sample, pitch_length_m, pitch_width_m, owner_id").order("session_date", { ascending: false }).limit(60);
  if (kind) query = query.eq("kind", kind);
  const { data: sessionData } = await query;
  const sessions = (sessionData ?? []) as GpsSessionRow[];
  const ids = sessions.map((s) => s.id);
  const { data: metricData } = ids.length ? await supabase.from("gps_session_metrics").select("session_id, athlete_id, total_distance_m, hsr_distance_m, sprint_count, max_speed_kmh, player_load").in("session_id", ids) : { data: [] };
  const metrics = (metricData ?? []) as Pick<GpsMetricRow, "session_id" | "athlete_id" | "total_distance_m" | "hsr_distance_m" | "sprint_count" | "max_speed_kmh" | "player_load">[];
  const of = (id: string) => metrics.filter((m) => m.session_id === id);

  const latest = sessions[0];
  const latestRows = latest ? of(latest.id) : [];
  const trend = sessions.slice(0, 12).reverse().map((s) => ({ date: s.session_date.slice(5), distance: Math.round(average(of(s.id).map((m) => m.total_distance_m))) }));

  // Workload ratio per athlete (staff only; an athlete's own page keeps to their sessions).
  const dateOf = new Map(sessions.map((s) => [s.id, s.session_date]));
  const load = workloads(metrics.map((m) => ({ athleteId: m.athlete_id, date: dateOf.get(m.session_id) ?? "", load: Number(m.player_load) || m.total_distance_m / 100 })).filter((e) => e.date));
  const loadIds = load.map((w) => w.athleteId);
  const { data: loadNames } = isAthlete || !loadIds.length ? { data: [] } : org?.org_role === "director"
    ? { data: ((await supabase.rpc("org_roster")).data ?? []).map((r: { athlete_id: string; full_name: string }) => ({ id: r.athlete_id, full_name: r.full_name })) }
    : await supabase.from("athletes").select("id, full_name").in("id", loadIds);
  const nameOf = (id: string) => ((loadNames ?? []) as { id: string; full_name: string }[]).find((a) => a.id === id)?.full_name ?? "—";
  const tone = { high: "red", low: "amber", ok: "green", unknown: "gray" } as const;

  return (
    <>
      <PageHeader
        title={tg.title}
        subtitle={tg.subtitle}
        actions={canImport && (
          <>
            <form action={loadSampleSession}><ConfirmSubmit variant="secondary" message={tg.sampleConfirm}>{tg.sample}</ConfirmSubmit></form>
            <ButtonLink href="/gps/import">{tg.import}</ButtonLink>
          </>
        )}
      />
      <FlashMessage error={sp.error} ok={sp.ok} />

      {sessions.length === 0 ? (
        <div className="space-y-6">
          <EmptyState title={tg.empty} body={canImport ? tg.emptyHelp : undefined} />
          {canImport && <ConnectionsCard t={t} canImport={canImport} />}
        </div>
      ) : (
        <div className="space-y-6">
          {latest && (
            <section aria-label={tg.last} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{tg.last} · <bdi>{latest.title}</bdi> · <span className="num">{latest.session_date}</span></h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label={tg.kpiDistance} value={formatDistance(average(latestRows.map((m) => m.total_distance_m)))} />
                <Stat label={tg.kpiHsr} value={formatDistance(average(latestRows.map((m) => m.hsr_distance_m)))} />
                <Stat label={tg.kpiSprints} value={Math.round(average(latestRows.map((m) => m.sprint_count)))} />
                <Stat label={tg.kpiTop} value={`${Math.max(0, ...latestRows.map((m) => Number(m.max_speed_kmh)))} ${tg.units.kmh}`} />
              </div>
            </section>
          )}

          {trend.length >= 2 && (
            <Card title={tg.trend}>
              <TrendChart data={trend} series={[{ key: "distance", label: tg.distance, color: "#23985e" }]} unit="m" />
            </Card>
          )}

          {!isAthlete && load.length > 0 && (
            <Card title={tg.workload.title}>
              <p className="mb-3 text-xs text-muted">{tg.workload.help}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="gps-workload">
                  <thead><tr className="text-start text-xs text-muted"><th className="py-1 text-start">{tg.workload.athlete}</th><th className="text-end">{tg.workload.acute}</th><th className="text-end">{tg.workload.chronic}</th><th className="text-end">{tg.workload.ratio}</th><th className="text-end">&nbsp;</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {load.map((w) => (
                      <tr key={w.athleteId}>
                        <td className="py-2"><bdi>{nameOf(w.athleteId)}</bdi></td>
                        <td className="num text-end">{w.acute}</td>
                        <td className="num text-end">{w.chronic}</td>
                        <td className="num text-end font-semibold">{w.ratio ?? "—"}</td>
                        <td className="text-end"><Badge tone={tone[w.status]}>{tg.workload.status[w.status]}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card
            title={tg.sessions}
            action={
              <nav aria-label={tg.sessions} className="flex gap-3 text-xs">
                <Link className={!kind ? "font-semibold text-ink" : "text-brand-700 hover:underline"} href="/gps">{tg.allKinds}</Link>
                <Link className={kind === "training" ? "font-semibold text-ink" : "text-brand-700 hover:underline"} href="/gps?kind=training">{tg.kinds.training}</Link>
                <Link className={kind === "match" ? "font-semibold text-ink" : "text-brand-700 hover:underline"} href="/gps?kind=match">{tg.kinds.match}</Link>
              </nav>
            }
          >
            <ul className="divide-y divide-line" data-testid="gps-sessions">
              {sessions.map((s) => {
                const rows = of(s.id);
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/gps/${s.id}`} className="font-medium text-ink hover:text-brand-700"><bdi>{s.title}</bdi></Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="num">{s.session_date}</span>
                        <Badge tone={s.kind === "match" ? "blue" : "gray"}>{tg.kinds[s.kind]}</Badge>
                        {s.is_sample && <Badge tone="amber">{tg.sampleBadge}</Badge>}
                        {!isAthlete && <span>{tg.athletes.replace("{n}", String(rows.length))}</span>}
                      </div>
                    </div>
                    <div className="num text-end text-sm">
                      <div className="font-semibold">{formatDistance(average(rows.map((m) => m.total_distance_m)))}</div>
                      <div className="text-xs text-muted">{tg.kpiDistance}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          {canImport && <ConnectionsCard t={t} canImport={canImport} />}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">{tg.medical}</p>
    </>
  );
}
