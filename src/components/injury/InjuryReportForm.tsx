import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { Dictionary } from "@/lib/i18n";
import { BODY_AREAS, INJURY_KINDS, MECHANISMS, SEVERITIES, SIDES } from "@/lib/injury";
import { reportInjury } from "@/app/(app)/injuries/actions";

/** Form to log an injury. Professionals also set diagnosis and expected return; athletes just describe it. */
export function InjuryReportForm({ athleteId, back, professional, t }: { athleteId?: string; back: string; professional: boolean; t: Dictionary }) {
  const ti = t.injury;
  return (
    <form action={reportInjury} className="space-y-3">
      {athleteId && <input type="hidden" name="athlete_id" value={athleteId} />}
      <input type="hidden" name="back" value={back} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={ti.area}>
          <Select name="body_area" required defaultValue="">
            <option value="" disabled>—</option>
            {BODY_AREAS.map((a) => <option key={a} value={a}>{ti.areas[a]}</option>)}
          </Select>
        </Field>
        <Field label={ti.side}>
          <Select name="side" defaultValue="">
            <option value="">—</option>
            {SIDES.map((s) => <option key={s} value={s}>{ti.sides[s]}</option>)}
          </Select>
        </Field>
        <Field label={ti.kind}>
          <Select name="kind" defaultValue="other">
            {INJURY_KINDS.map((k) => <option key={k} value={k}>{ti.kinds[k]}</option>)}
          </Select>
        </Field>
        <Field label={ti.mechanism}>
          <Select name="mechanism" defaultValue="">
            <option value="">—</option>
            {MECHANISMS.map((m) => <option key={m} value={m}>{ti.mechanisms[m]}</option>)}
          </Select>
        </Field>
        <Field label={ti.date}>
          <Input type="date" name="injury_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        {professional && (
          <Field label={ti.severity}>
            <Select name="severity" defaultValue="">
              <option value="">—</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{ti.severities[s]}</option>)}
            </Select>
          </Field>
        )}
        {professional && (
          <Field label={ti.expected}>
            <Input type="date" name="expected_return" />
          </Field>
        )}
      </div>
      {professional && (
        <Field label={ti.diagnosis}>
          <Textarea name="diagnosis" rows={2} maxLength={2000} />
        </Field>
      )}
      <Field label={ti.note}>
        <Textarea name="note" rows={2} maxLength={2000} />
      </Field>
      <SubmitButton>{ti.save}</SubmitButton>
    </form>
  );
}
