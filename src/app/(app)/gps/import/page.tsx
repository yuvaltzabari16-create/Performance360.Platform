import { ConnectionsCard } from "@/components/gps/ConnectionsCard";
import { Card, Field, FlashMessage, Input, PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireSection } from "@/lib/auth";
import { canWriteTraining } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { importGpsSession } from "../actions";

export default async function ImportGpsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { org, profile, t } = await requireSection("gps");
  if (profile.role === "athlete" || !canWriteTraining(org?.org_role ?? null)) redirect("/gps");
  const tg = t.gps;
  return (
    <>
      <PageHeader title={tg.importTitle} subtitle={tg.importHelp} crumbs={[{ href: "/gps", label: tg.title }]} />
      <FlashMessage error={sp.error} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <form action={importGpsSession} className="space-y-4" encType="multipart/form-data">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tg.sessionTitle}><Input name="title" maxLength={160} /></Field>
              <Field label={tg.date}><Input type="date" name="session_date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
              <Field label={tg.kind}>
                <Select name="kind" defaultValue="training">
                  <option value="training">{tg.kinds.training}</option>
                  <option value="match">{tg.kinds.match}</option>
                </Select>
              </Field>
              <Field label={tg.source}>
                <Select name="source" defaultValue="statsports">
                  {(["statsports", "catapult", "polar", "other"] as const).map((s) => <option key={s} value={s}>{tg.sources[s]}</option>)}
                </Select>
              </Field>
              <Field label={tg.fileType} className="sm:col-span-2">
                <Select name="type" defaultValue="summary">
                  <option value="summary">{tg.typeSummary}</option>
                  <option value="samples">{tg.typeSamples}</option>
                </Select>
              </Field>
              <Field label={tg.pitchLength}><Input type="number" name="pitch_length" defaultValue={105} min={20} max={140} step="0.5" /></Field>
              <Field label={tg.pitchWidth}><Input type="number" name="pitch_width" defaultValue={68} min={10} max={100} step="0.5" /></Field>
              <Field label={tg.file} hint={tg.fileHelp} className="sm:col-span-2">
                <input type="file" name="file" accept=".csv,.txt,text/csv" required className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700" />
              </Field>
            </div>
            <SubmitButton>{tg.submit}</SubmitButton>
          </form>
        </Card>
        <div className="space-y-6">
          <Card title={tg.formatTitle}>
            <p className="text-sm text-ink-soft">{tg.formatSummary}</p>
            <p className="mt-3 text-sm text-ink-soft">{tg.formatSamples}</p>
          </Card>
          <ConnectionsCard t={t} canImport={false} />
        </div>
      </div>
    </>
  );
}
