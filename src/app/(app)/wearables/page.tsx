import Link from "next/link";
import { Badge, Card, Checkbox, EmptyState, FlashMessage, PageHeader, Table, Td } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { WearableCharts } from "@/components/wearables/WearableCharts";
import { WearableSummary } from "@/components/wearables/WearableSummary";
import { requireProfile } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";
import { whoopConfig } from "@/lib/wearables/config";
import type { ConnectionRow, DailyRow, WearableProvider } from "@/lib/wearables/types";
import { disconnectWearable, eraseWearableData, importWearableFiles, setWearableSharing, syncWearable } from "./actions";

export const metadata = { title: "Wearables" };

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export default async function WearablesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { profile, t } = await requireProfile();
  const tw = t.wearables;
  return (
    <>
      <PageHeader title={tw.title} subtitle={profile.role === "athlete" ? tw.subtitleAthlete : tw.subtitleStaff} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      {profile.role === "athlete" ? <AthleteView t={t} /> : <StaffView t={t} />}
      <p className="mt-6 text-xs text-muted">{tw.disclaimer}</p>
    </>
  );
}

async function AthleteView({ t }: { t: Dictionary }) {
  const { supabase } = await requireProfile();
  const tw = t.wearables;
  const [{ data: conns }, { data: days }] = await Promise.all([
    supabase.from("wearable_connections").select("*"),
    supabase.from("wearable_daily").select("*").gte("day", since(30)).order("day", { ascending: false }).limit(120),
  ]);
  const connections = (conns ?? []) as ConnectionRow[];
  const rows = (days ?? []) as DailyRow[];
  const whoopReady = whoopConfig() != null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ProviderCard provider="whoop" conn={connections.find((c) => c.provider === "whoop")} t={t} live={whoopReady} />
        <ProviderCard provider="fitbit" conn={connections.find((c) => c.provider === "fitbit")} t={t} live={false} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title={tw.noData} />
      ) : (
        <Card title={tw.title}>
          <div className="space-y-6">
            <WearableSummary latest={rows[0]} t={t} />
            <WearableCharts rows={rows} t={t} />
          </div>
        </Card>
      )}
    </div>
  );
}

function ProviderCard({ provider, conn, t, live }: { provider: WearableProvider; conn: ConnectionRow | undefined; t: Dictionary; live: boolean }) {
  const tw = t.wearables;
  const connected = conn?.status === "connected" || conn?.status === "error";
  return (
    <div data-testid={`wearable-${provider}`}>
    <Card
      title={tw.providers[provider]}
      action={<Badge tone={conn?.status === "connected" ? "green" : conn?.status === "error" ? "amber" : "gray"}>{tw.status[conn?.status ?? "disconnected"]}{connected && ` · ${conn!.source === "api" ? tw.sourceApi : tw.sourceFile}`}</Badge>}
    >
      <div className="space-y-4">
        {connected && (
          <p className="text-xs text-muted">
            {tw.lastSync}: <span className="num">{conn!.last_sync_at ? new Date(conn!.last_sync_at).toLocaleString() : tw.never}</span>
            {conn!.last_error && <span className="ms-2 text-amber-800">({conn!.last_error})</span>}
          </p>
        )}

        {provider === "whoop" && (
          live ? (
            <div className="flex flex-wrap gap-2">
              {conn?.source === "api" && conn.status !== "disconnected" ? (
                <form action={syncWearable}><SubmitButton variant="secondary">{tw.sync}</SubmitButton></form>
              ) : (
                <Link href="/api/wearables/whoop/start" prefetch={false} className="inline-flex items-center rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">{tw.connect}</Link>
              )}
            </div>
          ) : <p className="text-sm text-ink-soft">{tw.notConfigured}</p>
        )}
        {provider === "fitbit" && <p className="text-sm text-ink-soft">{tw.fitbitNote}</p>}

        <form action={importWearableFiles} className="space-y-2 rounded-lg border border-line p-3">
          <input type="hidden" name="provider" value={provider} />
          <p className="text-sm font-medium text-ink">{tw.import}</p>
          <p className="text-xs text-muted">{tw.importHelp}</p>
          <input type="file" name="files" multiple required accept=".csv,.json,.txt" aria-label={tw.import} className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700" />
          <SubmitButton variant="secondary">{tw.importButton}</SubmitButton>
        </form>

        {connected && (
          <div className="space-y-3 border-t border-line pt-3">
            <form action={setWearableSharing} className="space-y-1.5">
              <input type="hidden" name="provider" value={provider} />
              <Checkbox name="share" label={tw.share} defaultChecked={conn!.share_with_staff} />
              <p className="text-xs text-muted">{conn!.share_with_staff ? tw.shareOn : tw.privateNote} {tw.shareHelp}</p>
              <SubmitButton variant="secondary">{t.common.save}</SubmitButton>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action={disconnectWearable}>
                <input type="hidden" name="provider" value={provider} />
                <ConfirmSubmit variant="danger" message={tw.disconnectConfirm}>{tw.disconnect}</ConfirmSubmit>
              </form>
              <form action={eraseWearableData}>
                <input type="hidden" name="provider" value={provider} />
                <ConfirmSubmit variant="danger" message={tw.eraseConfirm}>{tw.erase}</ConfirmSubmit>
              </form>
            </div>
          </div>
        )}
      </div>
    </Card>
    </div>
  );
}

async function StaffView({ t }: { t: Dictionary }) {
  const { supabase } = await requireProfile();
  const tw = t.wearables;
  const { data } = await supabase.from("wearable_daily").select("*").gte("day", since(14)).order("day", { ascending: false }).limit(2000);
  const rows = (data ?? []) as DailyRow[];
  const byAthlete = new Map<string, DailyRow[]>();
  rows.forEach((r) => byAthlete.set(r.athlete_id, [...(byAthlete.get(r.athlete_id) ?? []), r]));
  const ids = [...byAthlete.keys()];
  const { data: athletes } = ids.length ? await supabase.from("athletes").select("id, full_name").in("id", ids) : { data: [] };
  const nameOf = (id: string) => (athletes ?? []).find((a) => a.id === id)?.full_name ?? "—";
  const sorted = ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const num = (v: number | null, d = 0) => (v == null ? "—" : String(Math.round(v * 10 ** d) / 10 ** d));

  if (sorted.length === 0) return <EmptyState title={tw.noSharing} />;
  return (
    <Table head={[tw.athlete, tw.metrics.recovery, tw.avg7, tw.metrics.hrv, tw.metrics.rhr, tw.metrics.sleep, tw.metrics.strain, tw.latest]}>
      {sorted.map((id) => {
        const list = byAthlete.get(id)!;
        const latest = list[0];
        const week = list.filter((r) => r.recovery_score != null).slice(0, 7);
        const avg = week.length ? week.reduce((s, r) => s + (r.recovery_score ?? 0), 0) / week.length : null;
        return (
          <tr key={id}>
            <Td><Link href={`/athletes/${id}`} className="font-medium text-ink hover:text-brand-700"><bdi>{nameOf(id)}</bdi></Link></Td>
            <Td className="num font-semibold">{num(latest.recovery_score)}%</Td>
            <Td className="num">{num(avg)}%</Td>
            <Td className="num">{num(latest.hrv_ms, 1)}</Td>
            <Td className="num">{num(latest.resting_hr)}</Td>
            <Td className="num">{num(latest.sleep_hours, 1)}</Td>
            <Td className="num">{num(latest.strain, 1)}</Td>
            <Td className="num text-muted">{latest.day}</Td>
          </tr>
        );
      })}
    </Table>
  );
}
