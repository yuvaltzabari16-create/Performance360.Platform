import { Badge, ButtonLink, Card } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";

const PROVIDERS = ["statsports", "catapult", "polar"] as const;

/** Which GPS systems can be used today (file import) and which need vendor API access (live sync). */
export function ConnectionsCard({ t, canImport }: { t: Dictionary; canImport: boolean }) {
  const tg = t.gps;
  return (
    <Card title={tg.connectTitle}>
      <p className="mb-3 text-sm text-ink-soft">{tg.connectHelp}</p>
      <ul className="divide-y divide-line text-sm">
        {PROVIDERS.map((p) => (
          <li key={p} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span className="font-medium">{tg.sources[p]}</span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="green">{tg.connectFile} · {tg.connectAvailable}</Badge>
              <Badge>{tg.connectLive} · {tg.connectNeeds}</Badge>
            </span>
          </li>
        ))}
      </ul>
      {canImport && <div className="mt-4"><ButtonLink variant="secondary" href="/gps/import">{tg.import}</ButtonLink></div>}
    </Card>
  );
}
