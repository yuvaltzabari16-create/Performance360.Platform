import Link from "next/link";
import { Badge, Card, Checkbox, EmptyState, Field, FlashMessage, Input, PageHeader, Table, Td, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { TrendChart } from "@/components/charts/TrendChart";
import { getMyAthleteId, requireProfile } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";
import { readinessFlag, wellnessIndex } from "@/lib/metrics";
import type { ReadinessEntry } from "@/lib/types";
import { round } from "@/lib/units";
import { submitReadiness } from "./actions";

export const metadata = { title: "Readiness" };

const today = () => new Date().toISOString().slice(0, 10);

function ScaleInput({ name, label, hint, value }: { name: string; label: string; hint: string; value: number | null | undefined }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <p className="mb-1.5 text-xs text-muted">{hint}</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex-1">
            <input type="radio" name={name} value={n} defaultChecked={value === n} className="peer sr-only" />
            <span className="num flex h-10 cursor-pointer items-center justify-center rounded-lg border border-line text-sm peer-checked:border-brand-500 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300">{n}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Flag uses the athlete's own recent history; pain reports are always surfaced. */
function flagFor(entry: ReadinessEntry, history: ReadinessEntry[]) {
  const prior = history.filter((h) => h.entry_date < entry.entry_date).slice(0, 14).map((h) => wellnessIndex(h));
  return entry.pain_reported || readinessFlag(wellnessIndex(entry), prior);
}

export default async function ReadinessPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { profile, t } = await requireProfile();
  return profile.role === "athlete" ? <AthleteReadiness sp={sp} t={t} /> : <CoachReadiness sp={sp} t={t} />;
}

async function AthleteReadiness({ sp, t }: { sp: Record<string, string | undefined>; t: Dictionary }) {
  const { supabase } = await requireProfile();
  const tr = t.readiness;
  const athleteId = await getMyAthleteId();
  const { data } = athleteId
    ? await supabase.from("readiness_entries").select("*").eq("athlete_id", athleteId).order("entry_date", { ascending: false }).limit(60)
    : { data: [] };
  const entries = (data ?? []) as ReadinessEntry[];
  const current = entries.find((e) => e.entry_date === today());
  const chart = entries.slice(0, 28).reverse().map((e) => ({ date: e.entry_date.slice(5), index: wellnessIndex(e) == null ? null : round(wellnessIndex(e)!, 2) }));

  return (
    <>
      <PageHeader title={tr.title} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={current ? tr.updateToday : tr.checkIn}>
          <form action={submitReadiness} className="space-y-5">
            <input type="hidden" name="entry_date" value={today()} />
            <Field label={tr.sleepHours}><Input type="number" name="sleep_hours" min={0} max={24} step="0.5" defaultValue={current?.sleep_hours ?? ""} className="max-w-32" /></Field>
            <ScaleInput name="sleep_quality" label={tr.sleepQuality} hint={tr.scaleGood} value={current?.sleep_quality} />
            <ScaleInput name="fatigue" label={tr.fatigue} hint={tr.scaleBad} value={current?.fatigue} />
            <ScaleInput name="soreness" label={tr.soreness} hint={tr.scaleBad} value={current?.soreness} />
            <ScaleInput name="stress" label={tr.stress} hint={tr.scaleBad} value={current?.stress} />
            <ScaleInput name="mood" label={tr.mood} hint={tr.scaleGood} value={current?.mood} />
            <ScaleInput name="motivation" label={tr.motivation} hint={tr.scaleGood} value={current?.motivation} />
            <div className="space-y-2">
              <Checkbox name="pain_reported" label={tr.pain} defaultChecked={current?.pain_reported} />
              <Input name="pain_notes" placeholder={tr.painNotes} defaultValue={current?.pain_notes ?? ""} />
            </div>
            <Field label={t.common.notes}><Textarea name="notes" rows={2} defaultValue={current?.notes ?? ""} /></Field>
            <SubmitButton pendingText={t.common.saving}>{tr.submit}</SubmitButton>
          </form>
        </Card>
        <div className="space-y-6">
          <Card title={tr.index}>
            {chart.length === 0 ? <p className="text-sm text-muted">{tr.empty}</p> : <TrendChart data={chart} series={[{ key: "index", label: tr.index, color: "#23985e" }]} />}
            <p className="mt-2 text-xs text-muted">{tr.indexHelp}</p>
          </Card>
          <Card title={tr.history}>
            {entries.length === 0 ? <p className="text-sm text-muted">{tr.empty}</p> : (
              <ul className="divide-y divide-line text-sm">
                {entries.slice(0, 14).map((e) => (
                  <li key={e.id} className="flex justify-between py-2">
                    <span className="num">{e.entry_date}</span>
                    <span className="num text-ink-soft">{wellnessIndex(e) == null ? "—" : round(wellnessIndex(e)!, 1)}{e.sleep_hours != null && ` · ${e.sleep_hours}h`}{e.pain_reported && " · ⚠"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

async function CoachReadiness({ sp, t }: { sp: Record<string, string | undefined>; t: Dictionary }) {
  const { supabase } = await requireProfile();
  const tr = t.readiness;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today();
  const since = new Date(new Date(date + "T00:00:00Z").getTime() - 21 * 86400000).toISOString().slice(0, 10);
  const [{ data: athletes }, { data: entriesData }] = await Promise.all([
    supabase.from("athletes").select("id, full_name, sport, team_name").eq("status", "active").order("full_name").limit(500),
    supabase.from("readiness_entries").select("*").gte("entry_date", since).lte("entry_date", date).order("entry_date", { ascending: false }).limit(5000),
  ]);
  const entries = (entriesData ?? []) as ReadinessEntry[];
  const byAthlete = new Map<string, ReadinessEntry[]>();
  entries.forEach((e) => byAthlete.set(e.athlete_id, [...(byAthlete.get(e.athlete_id) ?? []), e]));

  const rows = (athletes ?? []).map((a) => {
    const hist = byAthlete.get(a.id) ?? [];
    const todayEntry = hist.find((e) => e.entry_date === date) ?? null;
    return { a, entry: todayEntry, index: todayEntry ? wellnessIndex(todayEntry) : null, flagged: todayEntry ? flagFor(todayEntry, hist) : false };
  });
  rows.sort((x, y) => Number(y.flagged) - Number(x.flagged) || Number(!!y.entry) - Number(!!x.entry) || x.a.full_name.localeCompare(y.a.full_name));
  const submitted = rows.filter((r) => r.entry).length;

  return (
    <>
      <PageHeader title={tr.title} subtitle={`${tr.teamOverview}: ${submitted}/${rows.length}`} />
      <form action="/readiness" className="mb-4 flex max-w-xs gap-2">
        <Input type="date" name="date" defaultValue={date} aria-label={t.common.date} />
        <button className="rounded-lg border border-line bg-white px-3 text-sm hover:bg-canvas" type="submit">{t.common.view}</button>
      </form>
      <p className="mb-4 text-xs text-muted">{tr.indexHelp} {tr.flagHelp}</p>
      {rows.length === 0 ? (
        <EmptyState title={t.athletes.empty} body={t.athletes.emptyHelp} />
      ) : (
        <Table head={[t.common.name, tr.index, tr.sleepHours, tr.fatigue, tr.soreness, tr.stress, t.common.status]}>
          {rows.map(({ a, entry, index, flagged }) => (
            <tr key={a.id} className={flagged ? "bg-amber-50/50" : undefined}>
              <Td>
                <Link href={`/athletes/${a.id}`} className="font-medium hover:text-brand-700">{a.full_name}</Link>
                {(a.team_name || a.sport) && <div className="text-xs text-muted">{a.team_name ?? a.sport}</div>}
              </Td>
              <Td><span className="num font-medium">{index == null ? "—" : round(index, 1)}</span></Td>
              <Td><span className="num">{entry?.sleep_hours ?? "—"}</span></Td>
              <Td><span className="num">{entry?.fatigue ?? "—"}</span></Td>
              <Td><span className="num">{entry?.soreness ?? "—"}</span></Td>
              <Td><span className="num">{entry?.stress ?? "—"}</span></Td>
              <Td>
                {!entry ? <Badge>{tr.missing}</Badge> : flagged ? <Badge tone="amber">{tr.flagged}{entry.pain_reported ? " · ⚠" : ""}</Badge> : <Badge tone="green">✓</Badge>}
                {entry?.pain_notes && <div className="mt-1 text-xs text-amber-900">{entry.pain_notes}</div>}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
