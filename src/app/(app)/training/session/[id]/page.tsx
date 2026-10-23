import { notFound } from "next/navigation";
import { Card, Field, FlashMessage, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { sessionLoad } from "@/lib/metrics";
import type { SessionExercise, TrainingSession } from "@/lib/types";
import { logSession } from "../../actions";
import { WorkoutChecklist } from "./WorkoutChecklist";

export const metadata = { title: "Log session" };

export default async function LogSessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, t, profile } = await requireProfile();
  const athleteId = sp.athlete;
  if (!isUuid(id) || !isUuid(athleteId)) notFound();
  const tt = t.training;

  const [{ data: sessionData }, { data: athlete }] = await Promise.all([
    supabase.from("training_sessions").select("*, training_programs(id, title)").eq("id", id).maybeSingle(),
    supabase.from("athletes").select("id, full_name").eq("id", athleteId).maybeSingle(),
  ]);
  if (!sessionData || !athlete) notFound();
  const session = sessionData as TrainingSession & { training_programs: { id: string; title: string } };
  const date = (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null) ?? new Date().toISOString().slice(0, 10);

  const [{ data: exData }, { data: existing }, { data: history }] = await Promise.all([
    supabase.from("session_exercises").select("*").eq("session_id", id).order("position"),
    supabase.from("workout_completions").select("*, exercise_logs(*)").eq("session_id", id).eq("athlete_id", athleteId).eq("completed_on", date).maybeSingle(),
    supabase.from("workout_completions").select("id, completed_on, status, session_rpe, duration_min").eq("session_id", id).eq("athlete_id", athleteId).order("completed_on", { ascending: false }).limit(10),
  ]);
  const exercises = (exData ?? []) as SessionExercise[];
  const logs = new Map<string, { done: boolean; actual_sets: number | null; actual_reps: string | null; actual_load_kg: number | null; feedback: string | null }>(
    ((existing?.exercise_logs ?? []) as { session_exercise_id: string; done: boolean; actual_sets: number | null; actual_reps: string | null; actual_load_kg: number | null; feedback: string | null }[]).map((l) => [l.session_exercise_id, l]),
  );

  return (
    <>
      <PageHeader
        title={`${tt.logTitle}: ${session.title}`}
        subtitle={`${athlete.full_name} · ${session.training_programs.title} · ${t.common.week} ${session.week_number} · ${t.common.day} ${session.day_number}`}
        crumbs={[{ href: profile.role === "athlete" ? "/training" : `/training/${session.training_programs.id}?week=${session.week_number}`, label: session.training_programs.title }]}
      />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <form action={logSession} className="space-y-6">
        <input type="hidden" name="session_id" value={id} />
        <input type="hidden" name="athlete_id" value={athleteId} />
        {exercises.length > 0 && (
          <WorkoutChecklist
            exercises={exercises}
            logs={Object.fromEntries(logs)}
            labels={{
              sections: tt.sections, fields: tt.builder.fields, progress: tt.builder.workoutProgress, details: tt.builder.workoutDetails,
              actualSets: tt.actualSets, actualReps: tt.actualReps, actualLoad: tt.actualLoad, notes: t.common.notes, markDone: tt.done,
            }}
          />
        )}
        <Card>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label={tt.completedOn}><Input type="date" name="completed_on" defaultValue={date} required /></Field>
            <Field label={tt.completion}>
              <Select name="status" defaultValue={existing?.status ?? "completed"}>
                <option value="completed">{tt.completed}</option>
                <option value="partial">{tt.partial}</option>
                <option value="skipped">{tt.skipped}</option>
              </Select>
            </Field>
            <Field label={tt.actualDuration}><Input type="number" name="duration_min" min={1} max={600} defaultValue={existing?.duration_min ?? session.planned_duration_min ?? ""} /></Field>
            <Field label={tt.sessionRpe}><Input type="number" name="session_rpe" min={0} max={10} step="0.5" defaultValue={existing?.session_rpe ?? ""} /></Field>
            <Field label={tt.feedback} className="sm:col-span-4"><Textarea name="athlete_feedback" rows={2} defaultValue={existing?.athlete_feedback ?? ""} /></Field>
          </div>
        </Card>
        <SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton>
      </form>

      {(history ?? []).length > 0 && (
        <Card className="mt-6" title={tt.history}>
          <ul className="divide-y divide-line text-sm">
            {(history ?? []).map((h) => (
              <li key={h.id} className="flex justify-between py-2">
                <a className="hover:text-brand-700" href={`/training/session/${id}?athlete=${athleteId}&date=${h.completed_on}`}>{h.completed_on}</a>
                <span className="num text-xs text-muted">
                  {tt[h.status as "completed" | "partial" | "skipped"]}
                  {sessionLoad(h.session_rpe, h.duration_min) != null && ` · ${sessionLoad(h.session_rpe, h.duration_min)} AU`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
