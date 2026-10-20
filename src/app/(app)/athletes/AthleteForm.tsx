import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { Dictionary } from "@/lib/i18n";
import type { Athlete, Units } from "@/lib/types";
import { round } from "@/lib/units";

export function AthleteForm({ action, athlete, t, units, cancelHref }: {
  action: (fd: FormData) => Promise<void>;
  athlete?: Athlete;
  t: Dictionary;
  units: Units;
  cancelHref: string;
}) {
  const a = athlete;
  const ta = t.athletes;
  const heightDefault = a?.height_cm == null ? "" : units === "imperial" ? round(a.height_cm / 2.54, 1) : a.height_cm;
  const massDefault = a?.body_mass_kg == null ? "" : units === "imperial" ? round(a.body_mass_kg / 0.45359237, 1) : a.body_mass_kg;
  return (
    <form action={action} className="space-y-6">
      {a && <input type="hidden" name="id" value={a.id} />}
      <Card title={ta.sections.personal}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t.common.name} *`}><Input name="full_name" defaultValue={a?.full_name} required maxLength={120} /></Field>
          <Field label={t.common.email}><Input type="email" name="email" defaultValue={a?.email ?? ""} /></Field>
          <Field label={ta.dob}><Input type="date" name="date_of_birth" defaultValue={a?.date_of_birth ?? ""} /></Field>
          <Field label={`${ta.gender} (${t.common.optional})`}><Input name="gender" defaultValue={a?.gender ?? ""} /></Field>
          <Field label={ta.phone}><Input type="tel" name="phone" defaultValue={a?.phone ?? ""} /></Field>
          <Field label={ta.prefLanguage}>
            <Select name="preferred_language" defaultValue={a?.preferred_language ?? ""}>
              <option value="">—</option>
              <option value="en">English</option>
              <option value="he">עברית</option>
            </Select>
          </Field>
          <Field label={ta.emergency} className="sm:col-span-2"><Input name="emergency_contact" defaultValue={a?.emergency_contact ?? ""} /></Field>
        </div>
      </Card>
      <Card title={ta.sections.sporting}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={ta.sport}><Input name="sport" defaultValue={a?.sport ?? ""} /></Field>
          <Field label={ta.position}><Input name="position" defaultValue={a?.position ?? ""} /></Field>
          <Field label={ta.team}><Input name="team_name" defaultValue={a?.team_name ?? ""} /></Field>
          <Field label={ta.club}><Input name="club" defaultValue={a?.club ?? ""} /></Field>
          <Field label={ta.level}><Input name="competitive_level" defaultValue={a?.competitive_level ?? ""} /></Field>
          <Field label={ta.trainingAge}><Input type="number" step="0.5" min="0" max="80" name="training_age_years" defaultValue={a?.training_age_years ?? ""} /></Field>
          <Field label={ta.season}><Input name="current_season" defaultValue={a?.current_season ?? ""} /></Field>
          <Field label={ta.dominantSide}>
            <Select name="dominant_side" defaultValue={a?.dominant_side ?? ""}>
              <option value="">—</option>
              <option value="left">{ta.left}</option>
              <option value="right">{ta.right}</option>
              <option value="both">{ta.both}</option>
            </Select>
          </Field>
          <Field label={ta.shortGoals}><Textarea name="short_term_goals" defaultValue={a?.short_term_goals ?? ""} /></Field>
          <Field label={ta.longGoals}><Textarea name="long_term_goals" defaultValue={a?.long_term_goals ?? ""} /></Field>
        </div>
      </Card>
      <Card title={ta.sections.physical}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${ta.height} (${units === "imperial" ? "in" : "cm"})`}><Input type="number" step="0.1" name="height" defaultValue={heightDefault} /></Field>
          <Field label={`${ta.mass} (${units === "imperial" ? "lb" : "kg"})`}><Input type="number" step="0.1" name="body_mass" defaultValue={massDefault} /></Field>
          <Field label={ta.availability}><Textarea name="training_availability" defaultValue={a?.training_availability ?? ""} /></Field>
          <Field label={ta.equipment}><Textarea name="equipment_availability" defaultValue={a?.equipment_availability ?? ""} /></Field>
        </div>
      </Card>
      <Card title={ta.sections.health}>
        <p className="mb-4 text-xs text-muted">{ta.healthNote}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={ta.injuryHistory}><Textarea name="injury_history" defaultValue={a?.injury_history ?? ""} /></Field>
          <Field label={ta.limitations}><Textarea name="limitations" defaultValue={a?.limitations ?? ""} /></Field>
          <Field label={ta.rehabStatus}><Textarea name="rehab_status" defaultValue={a?.rehab_status ?? ""} /></Field>
          <Field label={ta.modifications}><Textarea name="training_modifications" defaultValue={a?.training_modifications ?? ""} /></Field>
        </div>
      </Card>
      <div className="flex gap-2">
        <SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton>
        <a href={cancelHref} className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm text-ink-soft hover:bg-canvas">{t.common.cancel}</a>
      </div>
    </form>
  );
}
