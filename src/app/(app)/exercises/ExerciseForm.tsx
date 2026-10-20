import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { DIFFICULTIES, EXERCISE_CATEGORIES } from "@/lib/catalog";
import type { Dictionary } from "@/lib/i18n";
import type { Exercise } from "@/lib/types";

export function ExerciseForm({ action, exercise, t, cancelHref }: { action: (fd: FormData) => Promise<void>; exercise?: Exercise; t: Dictionary; cancelHref: string }) {
  const e = exercise;
  const te = t.exercises;
  return (
    <form action={action} className="space-y-6">
      {e && <input type="hidden" name="id" value={e.id} />}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t.common.name} *`} className="sm:col-span-2"><Input name="name" defaultValue={e?.name} required maxLength={160} /></Field>
          <Field label={te.category}>
            <Select name="category" defaultValue={e?.category ?? "strength"}>
              {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{te.categories[c]}</option>)}
            </Select>
          </Field>
          <Field label={te.difficulty}>
            <Select name="difficulty" defaultValue={e?.difficulty ?? "intermediate"}>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{te.difficulties[d]}</option>)}
            </Select>
          </Field>
          <Field label={te.objective}><Input name="primary_objective" defaultValue={e?.primary_objective ?? ""} /></Field>
          <Field label={te.pattern}><Input name="movement_pattern" defaultValue={e?.movement_pattern ?? ""} /></Field>
          <Field label={te.muscles} hint={te.commaHelp}><Input name="primary_muscles" defaultValue={e?.primary_muscles.join(", ")} /></Field>
          <Field label={te.equipment} hint={te.commaHelp}><Input name="equipment" defaultValue={e?.equipment.join(", ")} /></Field>
          <Field label={te.description} className="sm:col-span-2"><Textarea name="description" defaultValue={e?.description ?? ""} /></Field>
          <Field label={te.cues} hint={te.listHelp}><Textarea name="coaching_cues" defaultValue={e?.coaching_cues.join("\n")} /></Field>
          <Field label={te.errors} hint={te.listHelp}><Textarea name="common_errors" defaultValue={e?.common_errors.join("\n")} /></Field>
          <Field label={te.regressions}><Textarea name="regressions" rows={2} defaultValue={e?.regressions ?? ""} /></Field>
          <Field label={te.progressions}><Textarea name="progressions" rows={2} defaultValue={e?.progressions ?? ""} /></Field>
          <Field label={te.modNotes}><Textarea name="modification_notes" rows={2} defaultValue={e?.modification_notes ?? ""} /></Field>
          <Field label={te.prescription}><Textarea name="suggested_prescription" rows={2} defaultValue={e?.suggested_prescription ?? ""} /></Field>
          <Field label={te.video} hint={te.videoHelp}><Input type="url" name="video_url" pattern="https://.*" defaultValue={e?.video_url ?? ""} /></Field>
          <Field label={te.thumbnail}><Input type="url" name="thumbnail_url" pattern="https://.*" defaultValue={e?.thumbnail_url ?? ""} /></Field>
          <Field label={te.tags} hint={te.commaHelp}><Input name="tags" defaultValue={e?.tags.join(", ")} /></Field>
          <Field label={te.source}><Input name="source" defaultValue={e?.source ?? ""} /></Field>
        </div>
      </Card>
      <div className="flex gap-2">
        <SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton>
        <a href={cancelHref} className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm text-ink-soft hover:bg-canvas">{t.common.cancel}</a>
      </div>
    </form>
  );
}
