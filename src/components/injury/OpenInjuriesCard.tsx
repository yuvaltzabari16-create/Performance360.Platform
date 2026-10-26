import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import { daysOut, type InjuryStage } from "@/lib/injury";

export interface OpenInjury {
  id: string;
  athlete_id: string;
  body_area: string;
  stage: InjuryStage;
  injury_date: string;
  athletes?: { full_name: string } | null;
}

/** Compact list of open injuries for dashboards; each row opens the timeline. */
export function OpenInjuriesCard({ injuries, today, t, href, showAthlete }: { injuries: OpenInjury[]; today: string; t: Dictionary; href: string; showAthlete: boolean }) {
  const ti = t.injury;
  return (
    <Card title={ti.openInjuries} action={<Link className="text-xs text-brand-700 hover:underline" href={href}>{t.common.view}</Link>}>
      {injuries.length === 0 ? <p className="text-sm text-muted">{ti.noOpen}</p> : (
        <ul className="divide-y divide-line text-sm">
          {injuries.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2">
              <Link href={showAthlete ? `/athletes/${i.athlete_id}#injury-${i.id}` : href} className="min-w-0 hover:text-brand-700">
                <div className="truncate font-medium"><bdi>{showAthlete ? i.athletes?.full_name ?? "—" : ti.areas[i.body_area as keyof typeof ti.areas]}</bdi></div>
                <div className="text-xs text-muted">{showAthlete && `${ti.areas[i.body_area as keyof typeof ti.areas]} · `}{ti.daysOut.replace("{n}", String(daysOut(i.injury_date, today)))}</div>
              </Link>
              <Badge tone="amber">{ti.stages[i.stage]}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
