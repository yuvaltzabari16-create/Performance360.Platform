import Link from "next/link";
import { Card, Checkbox, Field, FlashMessage, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireProfessional } from "@/lib/auth";
import { TEST_CATEGORIES } from "@/lib/catalog";
import { isUuid } from "@/lib/forms";
import type { TestDefinition } from "@/lib/types";
import { createTestDefinition, recordTests } from "../actions";

export const metadata = { title: "Record test" };

interface Row {
  test?: TestDefinition;
  side: "both" | "left" | "right";
}

export default async function RecordTestPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, t } = await requireProfessional();
  const tt = t.testing;

  const [{ data: athletes }, { data: defsData }, { data: batteries }] = await Promise.all([
    supabase.from("athletes").select("id, full_name").eq("status", "active").order("full_name").limit(500),
    supabase.from("test_definitions").select("*").order("category").order("name"),
    supabase.from("test_batteries").select("id, name, test_ids").order("name"),
  ]);
  const defs = (defsData ?? []) as TestDefinition[];
  const battery = isUuid(sp.battery) ? (batteries ?? []).find((b) => b.id === sp.battery) : undefined;
  const athleteId = isUuid(sp.athlete) ? sp.athlete : "";

  // In battery mode each test gets its own row (bilateral tests get a row per side).
  const rows: Row[] = battery
    ? (battery.test_ids as string[]).flatMap((tid): Row[] => {
        const d = defs.find((x) => x.id === tid);
        if (!d) return [];
        return d.bilateral ? [{ test: d, side: "left" as const }, { test: d, side: "right" as const }] : [{ test: d, side: "both" as const }];
      })
    : [{ side: "both" }];
  const trialSlots = (row: Row) => Math.max(3, row.test?.default_trials ?? 3);

  return (
    <>
      <PageHeader title={tt.record} crumbs={[{ href: "/testing", label: tt.title }]} />
      <FlashMessage error={sp.error} ok={sp.ok} />

      {(batteries ?? []).length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{tt.batteries}:</span>
          <Link href={`/testing/new${athleteId ? `?athlete=${athleteId}` : ""}`} className={`rounded-lg px-2.5 py-1 ${!battery ? "bg-brand-50 font-medium text-brand-800" : "hover:bg-canvas"}`}>{tt.test}</Link>
          {(batteries ?? []).map((b) => (
            <Link key={b.id} href={`/testing/new?battery=${b.id}${athleteId ? `&athlete=${athleteId}` : ""}`} className={`rounded-lg px-2.5 py-1 ${battery?.id === b.id ? "bg-brand-50 font-medium text-brand-800" : "hover:bg-canvas"}`}>{b.name}</Link>
          ))}
        </div>
      )}

      <form action={recordTests} className="space-y-6">
        <input type="hidden" name="row_count" value={rows.length} />
        {battery && <input type="hidden" name="battery_id" value={battery.id} />}
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`${tt.athlete} *`}>
              <Select name="athlete_id" defaultValue={athleteId} required>
                <option value="" disabled>—</option>
                {(athletes ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </Select>
            </Field>
            <Field label={tt.testedOn}><Input type="date" name="tested_on" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
            <Field label={tt.quality}>
              <Select name="data_quality" defaultValue="good">
                {(["good", "questionable", "poor"] as const).map((q) => <option key={q} value={q}>{tt.qualities[q]}</option>)}
              </Select>
            </Field>
            <Field label={tt.conditions} className="sm:col-span-2"><Input name="conditions" placeholder="Indoor, synthetic track, 22°C" /></Field>
            <div className="flex items-end pb-2"><Checkbox name="is_baseline" label={tt.baseline} /></div>
          </div>
        </Card>

        {rows.map((row, i) => (
          <Card key={i} title={row.test ? `${row.test.name}${row.side !== "both" ? ` · ${tt.sides[row.side]}` : ""}` : tt.test}>
            <div className="grid gap-4 sm:grid-cols-3">
              {row.test ? (
                <>
                  <input type="hidden" name={`r${i}_test`} value={row.test.id} />
                  <input type="hidden" name={`r${i}_side`} value={row.side} />
                  <div className="text-sm text-ink-soft sm:col-span-3">{row.test.protocol}</div>
                </>
              ) : (
                <>
                  <Field label={`${tt.test} *`} className="sm:col-span-2">
                    <Select name={`r${i}_test`} defaultValue="" required>
                      <option value="" disabled>—</option>
                      {TEST_CATEGORIES.map((c) => {
                        const items = defs.filter((d) => d.category === c);
                        return items.length ? (
                          <optgroup key={c} label={tt.categories[c]}>
                            {items.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.unit}{d.higher_is_better ? " ↑" : " ↓"})</option>)}
                          </optgroup>
                        ) : null;
                      })}
                    </Select>
                  </Field>
                  <Field label={tt.side}>
                    <Select name={`r${i}_side`} defaultValue="both">
                      {(["both", "left", "right"] as const).map((s) => <option key={s} value={s}>{tt.sides[s]}</option>)}
                    </Select>
                  </Field>
                </>
              )}
              <fieldset className="sm:col-span-3">
                <legend className="mb-1.5 text-sm font-medium text-ink">{tt.trials}{row.test && <span className="font-normal text-muted"> ({row.test.unit})</span>}</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {Array.from({ length: Math.min(10, trialSlots(row) + 1) }, (_, j) => (
                    <Input key={j} name={`r${i}_t${j}`} type="number" step="any" inputMode="decimal" placeholder={`${tt.trialN} ${j + 1}`} aria-label={`${tt.trialN} ${j + 1}`} />
                  ))}
                </div>
              </fieldset>
              <Field label={tt.method} hint={i === 0 ? tt.methodHelp : undefined} className="sm:col-span-3"><Input name={`r${i}_method`} maxLength={200} /></Field>
            </div>
          </Card>
        ))}

        <Card>
          <Field label={t.common.notes}><Textarea name="notes" rows={2} /></Field>
          <p className="mt-3 text-xs text-muted">{tt.bestRule} {tt.measuredVsCalc}</p>
        </Card>
        <SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton>
      </form>

      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">+ {tt.customTest}</summary>
        <Card className="mt-3 max-w-2xl">
          <form action={createTestDefinition} className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t.common.name} *`}><Input name="name" required /></Field>
            <Field label={tt.shortName}><Input name="short_name" maxLength={30} /></Field>
            <Field label={tt.unit + " *"}><Input name="unit" required maxLength={20} placeholder="cm, s, kg, reps…" /></Field>
            <Field label={t.exercises.category}>
              <Select name="category" defaultValue="custom">{TEST_CATEGORIES.map((c) => <option key={c} value={c}>{tt.categories[c]}</option>)}</Select>
            </Field>
            <Field label={tt.defaultTrials}><Input type="number" name="default_trials" min={1} max={10} defaultValue={3} /></Field>
            <div className="flex flex-col justify-end gap-2 pb-2">
              <Checkbox name="higher_is_better" label={tt.higherBetter} defaultChecked />
              <Checkbox name="bilateral" label={tt.bilateral} />
            </div>
            <Field label={tt.protocol} className="sm:col-span-2"><Textarea name="protocol" rows={3} /></Field>
            <div><SubmitButton variant="secondary">{t.common.create}</SubmitButton></div>
          </form>
        </Card>
      </details>
    </>
  );
}
