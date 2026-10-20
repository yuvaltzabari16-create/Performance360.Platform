import { Card, Checkbox, Field, FlashMessage, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireProfessional } from "@/lib/auth";
import { PROGRAM_TYPES } from "@/lib/catalog";
import { createProgram } from "../actions";

export const metadata = { title: "New program" };

export default async function NewProgramPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await requireProfessional();
  const tt = t.training;
  return (
    <>
      <PageHeader title={tt.newProgram} crumbs={[{ href: "/training", label: tt.title }]} />
      <FlashMessage error={sp.error} />
      <Card className="max-w-2xl">
        <form action={createProgram} className="grid gap-4 sm:grid-cols-2">
          <Field label={`${tt.programTitle} *`} className="sm:col-span-2"><Input name="title" required maxLength={160} /></Field>
          <Field label={tt.type}>
            <Select name="program_type" defaultValue="block">
              {PROGRAM_TYPES.map((p) => <option key={p} value={p}>{tt.types[p]}</option>)}
            </Select>
          </Field>
          <Field label={tt.weeks}><Input type="number" name="num_weeks" min={1} max={104} defaultValue={4} /></Field>
          <Field label={tt.sport}><Input name="sport" /></Field>
          <Field label={tt.goal}><Input name="goal" /></Field>
          <Field label={tt.description} className="sm:col-span-2"><Textarea name="description" /></Field>
          <div className="sm:col-span-2"><Checkbox name="is_template" label={tt.template} /></div>
          <div className="sm:col-span-2"><SubmitButton pendingText={t.common.saving}>{t.common.create}</SubmitButton></div>
        </form>
      </Card>
    </>
  );
}
