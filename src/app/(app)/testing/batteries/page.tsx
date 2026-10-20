import Link from "next/link";
import { Card, Field, FlashMessage, Input, PageHeader, Select } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { requireProfessional } from "@/lib/auth";
import { TEST_CATEGORIES } from "@/lib/catalog";
import type { TestDefinition } from "@/lib/types";
import { createBattery, deleteBattery } from "../actions";

export const metadata = { title: "Test batteries" };

export default async function BatteriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, t } = await requireProfessional();
  const tt = t.testing;
  const [{ data: batteries }, { data: defsData }] = await Promise.all([
    supabase.from("test_batteries").select("*").order("name"),
    supabase.from("test_definitions").select("*").order("category").order("name"),
  ]);
  const defs = (defsData ?? []) as TestDefinition[];
  const nameOf = (id: string) => defs.find((d) => d.id === id)?.short_name ?? defs.find((d) => d.id === id)?.name ?? "?";

  return (
    <>
      <PageHeader title={tt.batteries} crumbs={[{ href: "/testing", label: tt.title }]} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {(batteries ?? []).length === 0 && <p className="text-sm text-muted">—</p>}
          {(batteries ?? []).map((b) => (
            <Card key={b.id} title={b.name} action={<Link href={`/testing/new?battery=${b.id}`} className="text-xs font-medium text-brand-700 hover:underline">{tt.record}</Link>}>
              {b.description && <p className="mb-2 text-sm text-ink-soft">{b.description}</p>}
              <p className="text-sm">{(b.test_ids as string[]).map(nameOf).join(" · ")}</p>
              <form action={deleteBattery} className="mt-3">
                <input type="hidden" name="id" value={b.id} />
                <ConfirmSubmit variant="ghost" className="px-2 py-1 text-xs text-red-700" message={`${t.common.delete}?`}>{t.common.delete}</ConfirmSubmit>
              </form>
            </Card>
          ))}
        </div>
        <Card title={tt.newBattery}>
          <form action={createBattery} className="space-y-3">
            <Field label={tt.batteryName}><Input name="name" required placeholder="Football U18 preseason" /></Field>
            <Field label={t.training.description}><Input name="description" /></Field>
            <Field label={tt.test}>
              <Select name="test_ids" multiple size={12} required>
                {TEST_CATEGORIES.map((c) => {
                  const items = defs.filter((d) => d.category === c);
                  return items.length ? <optgroup key={c} label={tt.categories[c]}>{items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup> : null;
                })}
              </Select>
            </Field>
            <SubmitButton>{t.common.create}</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
