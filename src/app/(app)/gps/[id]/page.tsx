import Link from "next/link";
import { notFound } from "next/navigation";
import { PitchHeatMap } from "@/components/gps/PitchHeatMap";
import { ZoneBar } from "@/components/gps/ZoneBar";
import { Badge, Card, FlashMessage, PageHeader, Stat, Table, Td } from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui/client";
import { requireSection } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { average, formatDistance, percentDiff, perMinute, type GpsMetricRow, type GpsSessionRow } from "@/lib/gps/format";
import { deleteGpsSession } from "../actions";

export default async function GpsSessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile, org, t } = await requireSection("gps");
  if (!isUuid(id)) notFound();
  const tg = t.gps;
  const isAthlete = profile.role === "athlete";

  const { data: session } = await supabase.from("gps_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) notFound();
  const s = session as GpsSessionRow;
  const { data: metricData } = await supabase.from("gps_session_metrics").select("*").eq("session_id", id).order("total_distance_m", { ascending: false });
  const rows = (metricData ?? []) as GpsMetricRow[];
  // The director cannot read athlete records; names come from the roster list they are allowed to see.
  const { data: athletes } = org?.org_role === "director"
    ? { data: ((await supabase.rpc("org_roster")).data ?? []).map((r: { athlete_id: string; full_name: string }) => ({ id: r.athlete_id, full_name: r.full_name })) }
    : rows.length ? await supabase.from("athletes").select("id, full_name").in("id", rows.map((r) => r.athlete_id)) : { data: [] };
  const nameOf = (athleteId: string) => ((athletes ?? []) as { id: string; full_name: string }[]).find((a) => a.id === athleteId)?.full_name ?? "—";

  const selected = rows.find((r) => r.athlete_id === sp.athlete) ?? rows[0];
  const avg = (pick: (r: GpsMetricRow) => number) => average(rows.map(pick));
  const maxDistance = Math.max(1, ...rows.map((r) => r.total_distance_m));
  const diff = (value: number, ref: number) => {
    const d = percentDiff(value, ref);
    return d == null ? null : <span className={`num text-xs ${d >= 0 ? "text-brand-700" : "text-muted"}`}>{d > 0 ? "+" : ""}{d}%</span>;
  };

  return (
    <>
      <PageHeader
        title={s.title}
        subtitle={`${s.session_date} · ${tg.kinds[s.kind]}${s.duration_min ? ` · ${s.duration_min} ${tg.minutes}` : ""}`}
        crumbs={[{ href: "/gps", label: tg.back }]}
        actions={s.owner_id === user.id && (
          <form action={deleteGpsSession}>
            <input type="hidden" name="session_id" value={s.id} />
            <ConfirmSubmit variant="danger" message={tg.deleteConfirm}>{tg.delete}</ConfirmSubmit>
          </form>
        )}
      />
      <FlashMessage error={sp.error} ok={sp.ok} />
      {s.is_sample && <div className="mb-4"><Badge tone="amber">{tg.sampleBadge}</Badge></div>}

      {rows.length === 0 ? null : (
        <div className="space-y-6">
          {!isAthlete && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={tg.kpiDistance} value={formatDistance(avg((r) => r.total_distance_m))} hint={tg.teamAverage} />
              <Stat label={tg.kpiHsr} value={formatDistance(avg((r) => r.hsr_distance_m))} hint={tg.teamAverage} />
              <Stat label={tg.kpiSprints} value={Math.round(avg((r) => r.sprint_count))} hint={tg.teamAverage} />
              <Stat label={tg.kpiTop} value={`${Math.max(...rows.map((r) => Number(r.max_speed_kmh)))} ${tg.units.kmh}`} />
            </div>
          )}

          <Card title={isAthlete ? undefined : tg.athletes.replace("{n}", String(rows.length))}>
            <Table head={[tg.athlete, tg.minutes, tg.distance, tg.distancePerMin, tg.hsr, tg.sprintDist, tg.sprints, tg.maxSpeed, tg.accels, tg.decels, tg.load, tg.avgHr]}>
              {rows.map((r) => (
                <tr key={r.id} className={r.athlete_id === selected?.athlete_id ? "bg-brand-50/60" : undefined}>
                  <Td>
                    <Link href={`/gps/${s.id}?athlete=${r.athlete_id}`} className="font-medium text-ink hover:text-brand-700" scroll={false}><bdi>{nameOf(r.athlete_id)}</bdi></Link>
                  </Td>
                  <Td className="num">{r.minutes}</Td>
                  <Td>
                    <div className="num font-semibold">{formatDistance(r.total_distance_m)}</div>
                    <div className="mt-1 h-1.5 w-24 rounded-full bg-canvas"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.total_distance_m / maxDistance) * 100}%` }} /></div>
                  </Td>
                  <Td className="num">{perMinute(r.total_distance_m, Number(r.minutes))}</Td>
                  <Td className="num">{r.hsr_distance_m} {tg.units.m}</Td>
                  <Td className="num">{r.sprint_distance_m} {tg.units.m}</Td>
                  <Td className="num">{r.sprint_count}</Td>
                  <Td className="num">{r.max_speed_kmh}</Td>
                  <Td className="num">{r.accel_count}</Td>
                  <Td className="num">{r.decel_count}</Td>
                  <Td className="num">{r.player_load}</Td>
                  <Td className="num">{r.avg_hr ?? "—"}</Td>
                </tr>
              ))}
            </Table>
          </Card>

          {selected && (
            <div className="grid gap-6 lg:grid-cols-5" id="athlete-detail">
              <Card title={`${tg.heatTitle} · ${tg.heatFor.replace("{name}", nameOf(selected.athlete_id))}`} className="lg:col-span-3">
                <PitchHeatMap heat={selected.heat} length={Number(s.pitch_length_m)} width={Number(s.pitch_width_m)} t={t} />
                {selected.heat && <p className="mt-2 text-xs text-muted">{tg.heatHelp}</p>}
              </Card>
              <div className="space-y-6 lg:col-span-2">
                <Card title={tg.zonesTitle}>
                  {selected.zones.length ? <ZoneBar zones={selected.zones} t={t} /> : <p className="text-sm text-muted">{tg.heatEmpty}</p>}
                </Card>
                {!isAthlete && rows.length > 1 && (
                  <Card title={tg.vsAverage}>
                    <ul className="space-y-2 text-sm">
                      {([
                        [tg.distance, selected.total_distance_m, avg((r) => r.total_distance_m)],
                        [tg.hsr, selected.hsr_distance_m, avg((r) => r.hsr_distance_m)],
                        [tg.sprints, selected.sprint_count, avg((r) => r.sprint_count)],
                        [tg.load, Number(selected.player_load), avg((r) => Number(r.player_load))],
                      ] as [string, number, number][]).map(([label, value, ref]) => (
                        <li key={label} className="flex items-center justify-between"><span>{label}</span>{diff(value, ref)}</li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </div>
          )}
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">{tg.definitions}</summary>
            <p className="mt-2 max-w-3xl">{tg.defText}</p>
          </details>
          <p className="text-xs text-muted">{tg.medical}</p>
        </div>
      )}
    </>
  );
}
