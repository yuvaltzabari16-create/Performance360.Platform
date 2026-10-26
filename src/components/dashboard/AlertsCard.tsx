import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { AlertKind, StaffAlert } from "@/lib/alerts";

const tone: Record<AlertKind, "red" | "amber"> = { workload_high: "red", recovery_low: "red", workload_low: "amber" };

/** Staff alerts: workload ratio out of range and low shared recovery. A prompt for a conversation, never a diagnosis. */
export function AlertsCard({ alerts, names, t }: { alerts: StaffAlert[]; names: Map<string, string>; t: Dictionary }) {
  const ta = t.dashboard.alerts;
  return (
    <Card title={ta.title} action={<Link className="text-xs text-brand-700 hover:underline" href="/gps">{t.gps.title}</Link>}>
      <div data-testid="staff-alerts">
        {alerts.length === 0 ? <p className="text-sm text-muted">{ta.none}</p> : (
          <ul className="divide-y divide-line text-sm">
            {alerts.map((a) => (
              <li key={`${a.athleteId}-${a.kind}`} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/athletes/${a.athleteId}`} className="min-w-0 truncate font-medium hover:text-brand-700"><bdi>{names.get(a.athleteId) ?? "—"}</bdi></Link>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="num text-xs text-muted">{a.kind === "recovery_low" ? `${a.value}%` : a.value}</span>
                  <Badge tone={tone[a.kind]}>{ta.kinds[a.kind]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">{ta.help}</p>
    </Card>
  );
}
