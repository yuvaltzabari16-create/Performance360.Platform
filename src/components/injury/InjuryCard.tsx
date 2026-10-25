import Link from "next/link";
import { Badge } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { Field, Input, Select, Textarea } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import { daysOut, nextStage, previousStage, returnOutlook, SEVERITIES, type InjuryStage } from "@/lib/injury";
import { addInjuryNote, changeInjuryStage, updateInjuryDetails } from "@/app/(app)/injuries/actions";
import { AttachmentsPanel } from "@/components/files/AttachmentsPanel";
import type { AttachmentRow } from "@/lib/files/data";
import { StageTrack } from "./StageTrack";
import type { InjuryEventRow, InjuryRow } from "./types";

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), text);

/** One-line summary of how the expected return compares with today. */
function outlookText(injury: InjuryRow, today: string, t: Dictionary): string | null {
  if (injury.status === "resolved") return null;
  const o = returnOutlook(injury.expected_return, today);
  if (o.kind === "ahead") return fill(t.injury.outlookAhead, { n: o.days });
  if (o.kind === "today") return t.injury.outlookToday;
  if (o.kind === "overdue") return fill(t.injury.outlookOverdue, { n: o.days });
  return null;
}

interface Props {
  injury: InjuryRow;
  events: InjuryEventRow[];
  today: string;
  locale: string;
  t: Dictionary;
  back: string;
  /** Staff can move stages and edit details; athletes can only add notes. */
  professional: boolean;
  /** Whether the viewer may record the final clearance. */
  canClear: boolean;
  /** Files attached to this injury, whether the viewer may add more, and who they are. */
  files: AttachmentRow[];
  canUpload: boolean;
  userId: string;
}

/** An injury with its stage track, controls and timeline. Server component; all changes go through server actions. */
export function InjuryCard({ injury, events, today, locale, t, back, professional, canClear, files, canUpload, userId }: Props) {
  const ti = t.injury;
  const resolved = injury.status === "resolved";
  const next = nextStage(injury.stage);
  const prev = previousStage(injury.stage);
  const outlook = outlookText(injury, today, t);
  const out = daysOut(injury.injury_date, today, injury.resolved_on);
  const title = `${ti.areas[injury.body_area as keyof typeof ti.areas] ?? injury.body_area}${injury.side ? ` · ${ti.sides[injury.side as keyof typeof ti.sides]}` : ""}`;

  const hidden = (
    <>
      <input type="hidden" name="injury_id" value={injury.id} />
      <input type="hidden" name="athlete_id" value={injury.athlete_id} />
      <input type="hidden" name="back" value={back} />
    </>
  );

  /** A stage-change form for one target stage. */
  const stageForm = (target: InjuryStage, label: string, primary: boolean) => {
    const clearing = target === "cleared";
    const blocked = clearing && !canClear;
    return (
      <form action={changeInjuryStage} className="flex flex-1 flex-col gap-2 rounded-lg bg-canvas p-3" key={target}>
        {hidden}
        <input type="hidden" name="stage" value={target} />
        <Textarea name="note" rows={2} maxLength={2000} required={clearing} disabled={blocked} aria-label={clearing ? ti.clearNote : ti.stageNote} placeholder={clearing ? ti.clearNote : ti.stageNote} />
        {blocked ? <p className="text-xs text-muted">{ti.clearanceBlocked}</p> : clearing ? <p className="text-xs text-muted">{ti.clearHelp}</p> : null}
        <SubmitButton variant={primary ? "primary" : "secondary"} disabled={blocked}>{label}</SubmitButton>
      </form>
    );
  };

  return (
    <article id={`injury-${injury.id}`} className="scroll-mt-20 space-y-4 rounded-xl border border-line bg-surface p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink"><bdi>{title}</bdi></h3>
          <p className="mt-0.5 text-xs text-muted">
            {[ti.kinds[injury.kind as keyof typeof ti.kinds], injury.mechanism && ti.mechanisms[injury.mechanism as keyof typeof ti.mechanisms], injury.severity && ti.severities[injury.severity as keyof typeof ti.severities]].filter(Boolean).join(" · ")}
            {" · "}<span className="num">{injury.injury_date}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={resolved ? "green" : "amber"}>{ti.stages[injury.stage]}</Badge>
          <Badge>{fill(resolved ? ti.daysOutResolved : ti.daysOut, { n: out })}</Badge>
        </div>
      </header>

      <StageTrack stage={injury.stage} t={t} />
      {outlook && <p className="text-sm text-ink-soft">{outlook}</p>}
      {resolved && injury.resolved_on && <p className="text-sm text-brand-700">{fill(ti.resolvedOn, { date: injury.resolved_on })}</p>}
      {injury.diagnosis && <p className="whitespace-pre-line rounded-lg bg-canvas p-3 text-sm text-ink"><bdi>{injury.diagnosis}</bdi></p>}

      {professional && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            {next && stageForm(next, fill(ti.advance, { stage: ti.stages[next] }), true)}
            {prev && stageForm(prev, fill(ti.stepBack, { stage: ti.stages[prev] }), false)}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-brand-700">{ti.editDetails}</summary>
            <form action={updateInjuryDetails} className="mt-3 space-y-3">
              {hidden}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={ti.severity}>
                  <Select name="severity" defaultValue={injury.severity ?? ""}>
                    <option value="">—</option>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{ti.severities[s]}</option>)}
                  </Select>
                </Field>
                <Field label={ti.expected}>
                  <Input type="date" name="expected_return" defaultValue={injury.expected_return ?? ""} />
                </Field>
              </div>
              <Field label={ti.diagnosis}>
                <Textarea name="diagnosis" rows={2} maxLength={2000} defaultValue={injury.diagnosis ?? ""} />
              </Field>
              <SubmitButton variant="secondary">{ti.editDetails}</SubmitButton>
            </form>
          </details>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{ti.timeline}</h4>
        <ol className="space-y-3 border-s border-line ps-4">
          {events.map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute -start-[21px] top-1.5 size-2.5 rounded-full bg-brand-400 ring-4 ring-surface" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span className="font-medium text-ink">
                  {ti.events[e.kind]}
                  {e.stage && (e.kind === "stage_changed" || e.kind === "cleared" || e.kind === "reopened") ? ` · ${ti.stages[e.stage]}` : ""}
                </span>
                <span className="num">{new Date(e.created_at).toLocaleDateString(locale)}</span>
                {e.author_name && <span><bdi>{fill(ti.by, { name: e.author_name })}</bdi>{e.author_role && ` · ${t.orgRoles[e.author_role as keyof typeof t.orgRoles] ?? ""}`}</span>}
              </div>
              {e.note && <p className="mt-0.5 whitespace-pre-line text-ink"><bdi>{e.note}</bdi></p>}
            </li>
          ))}
        </ol>
        <form action={addInjuryNote} className="mt-3 flex flex-col gap-2 sm:flex-row">
          {hidden}
          <Textarea name="note" rows={1} required maxLength={2000} aria-label={ti.note} placeholder={ti.notePlaceholder} className="flex-1" />
          <SubmitButton variant="secondary">{ti.addNote}</SubmitButton>
        </form>
      </div>

      <AttachmentsPanel kind="injury" refId={injury.id} athleteId={injury.athlete_id} back={back} files={files} canUpload={canUpload} userId={userId} t={t} />

      {professional && !resolved && (
        <Link href="/exercises?category=rehab" className="inline-block text-sm text-brand-700 hover:underline">{ti.openRehab}</Link>
      )}
    </article>
  );
}
