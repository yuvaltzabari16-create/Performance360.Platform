import { Badge, Card, EmptyState, Field, FlashMessage, Input, PageHeader, Textarea } from "@/components/ui";
import { AutoSubmitSelect, ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { getMyAthleteId, requireProfile } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";
import { isUuid } from "@/lib/forms";
import type { RtpExercise, RtpPhase, RtpPlan } from "@/lib/types";
import { addExercise, addPhase, createPlan, logExercise, setPhaseStatus, setPlanStatus } from "./actions";

export const metadata = { title: "Return to Play" };

const tone = { locked: "gray", in_progress: "amber", cleared: "green" } as const;

export default async function RehabPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile, t } = await requireProfile();
  const tr = t.rehab;
  const isAthlete = profile.role === "athlete";

  let athleteId: string | null = null;
  let athletes: { id: string; full_name: string }[] = [];
  if (isAthlete) {
    athleteId = await getMyAthleteId();
  } else {
    const { data } = await supabase.from("athletes").select("id, full_name").eq("status", "active").order("full_name").limit(500);
    athletes = (data ?? []) as { id: string; full_name: string }[];
    athleteId = isUuid(sp.athlete) && athletes.some((a) => a.id === sp.athlete) ? sp.athlete! : null;
  }

  let plans: RtpPlan[] = [];
  let phases: RtpPhase[] = [];
  let exercises: RtpExercise[] = [];
  if (athleteId) {
    const { data: planData } = await supabase.from("rtp_plans").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false });
    plans = (planData ?? []) as RtpPlan[];
    if (plans.length) {
      const { data: phaseData } = await supabase.from("rtp_phases").select("*").in("plan_id", plans.map((p) => p.id)).order("position");
      phases = (phaseData ?? []) as RtpPhase[];
      if (phases.length) {
        const { data: exData } = await supabase.from("rtp_phase_exercises").select("*").in("phase_id", phases.map((p) => p.id)).order("position");
        exercises = (exData ?? []) as RtpExercise[];
      }
    }
  }

  return (
    <>
      <PageHeader title={tr.title} subtitle={tr.subtitle} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <p className="mb-4 rounded-lg border border-line bg-canvas px-4 py-3 text-xs text-ink-soft">{tr.disclaimer}</p>

      {!isAthlete && (
        athletes.length === 0 ? <EmptyState title={tr.noAthletes} /> : (
          <form action="/rehab" className="mb-6 max-w-sm">
            <Field label={tr.chooseAthlete}>
              <AutoSubmitSelect name="athlete" defaultValue={athleteId ?? ""}>
                <option value="">—</option>
                {athletes.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </AutoSubmitSelect>
            </Field>
            <noscript><button type="submit">{t.common.view}</button></noscript>
          </form>
        )
      )}

      {athleteId && (
        <div className="space-y-6">
          {plans.length === 0 && <EmptyState title={tr.noPlans} />}
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} athleteId={athleteId!} isAthlete={isAthlete} t={t}
              phases={phases.filter((ph) => ph.plan_id === plan.id)}
              exercises={exercises} />
          ))}
          {!isAthlete && (
            <Card title={tr.newPlan}>
              <form action={createPlan} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="athlete_id" value={athleteId} />
                <Field label={tr.planTitle}><Input name="title" required maxLength={160} /></Field>
                <Field label={tr.context}><Input name="context" maxLength={4000} /></Field>
                <div className="sm:col-span-2"><SubmitButton pendingText={t.common.saving}>{tr.createPlan}</SubmitButton></div>
              </form>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function PlanCard({ plan, phases, exercises, athleteId, isAthlete, t }: {
  plan: RtpPlan; phases: RtpPhase[]; exercises: RtpExercise[]; athleteId: string; isAthlete: boolean; t: Dictionary;
}) {
  const tr = t.rehab;
  const editable = !isAthlete && plan.status === "active";
  return (
    <Card
      title={<span className="flex flex-wrap items-center gap-2">{plan.title} <Badge>{tr.planStatus[plan.status]}</Badge></span>}
      action={editable && phases.length > 0 ? (
        <form action={setPlanStatus}>
          <input type="hidden" name="athlete_id" value={athleteId} />
          <input type="hidden" name="plan_id" value={plan.id} />
          <input type="hidden" name="status" value="completed" />
          <button type="submit" className="text-xs text-brand-700 hover:underline">{tr.closePlan}</button>
        </form>
      ) : undefined}
    >
      {plan.context && <p className="mb-4 text-sm text-ink-soft">{plan.context}</p>}
      <h3 className="mb-2 text-sm font-semibold">{tr.phases}</h3>
      <ol className="space-y-4">
        {phases.map((ph) => (
          <li key={ph.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{ph.position}. {ph.title}</span>
              <Badge tone={tone[ph.status]}>{tr.status[ph.status]}</Badge>
            </div>
            {ph.description && <p className="mt-1 text-sm text-ink-soft">{ph.description}</p>}
            {ph.criteria.length > 0 && (
              <ul className="mt-2 list-disc ps-5 text-sm">{ph.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
            )}
            {ph.status === "cleared" && ph.cleared_by_name && (
              <p className="mt-2 text-xs text-ink-soft">
                {tr.clearedOn.replace("{name}", ph.cleared_by_name + (ph.cleared_by_role ? ` (${ph.cleared_by_role})` : "")).replace("{date}", (ph.cleared_at ?? "").slice(0, 10))}
                {ph.clearance_note && ` — ${ph.clearance_note}`}
              </p>
            )}

            <PhaseExercises phase={ph} items={exercises.filter((e) => e.phase_id === ph.id)} athleteId={athleteId} isAthlete={isAthlete} editable={editable} t={t} />

            {editable && (
              <div className="mt-3 flex flex-wrap items-start gap-2">
                {ph.status === "locked" && (
                  <StatusButton athleteId={athleteId} phaseId={ph.id} status="in_progress" label={tr.start} />
                )}
                {ph.status !== "locked" && (
                  <StatusButton athleteId={athleteId} phaseId={ph.id} status={ph.status === "cleared" ? "in_progress" : "locked"} label={tr.reopen} />
                )}
                {ph.status === "in_progress" && (
                  <details className="w-full">
                    <summary className="cursor-pointer text-sm font-medium text-brand-700">{tr.recordClearance}</summary>
                    <form action={setPhaseStatus} className="mt-3 grid gap-3 sm:grid-cols-3">
                      <input type="hidden" name="athlete_id" value={athleteId} />
                      <input type="hidden" name="phase_id" value={ph.id} />
                      <input type="hidden" name="status" value="cleared" />
                      <Field label={tr.clearedBy}><Input name="cleared_by_name" required maxLength={160} /></Field>
                      <Field label={tr.clearedRole}><Input name="cleared_by_role" maxLength={80} /></Field>
                      <Field label={tr.clearanceNote}><Input name="note" maxLength={4000} /></Field>
                      <div className="sm:col-span-3"><ConfirmSubmit message={tr.clearanceConfirm}>{tr.recordClearance}</ConfirmSubmit></div>
                    </form>
                  </details>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {editable && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-700">{tr.addPhase}</summary>
          <form action={addPhase} className="mt-3 grid gap-3">
            <input type="hidden" name="athlete_id" value={athleteId} />
            <input type="hidden" name="plan_id" value={plan.id} />
            <Field label={tr.phaseTitle}><Input name="title" required maxLength={160} /></Field>
            <Field label={tr.description}><Textarea name="description" rows={2} maxLength={4000} /></Field>
            <Field label={tr.criteria}><Textarea name="criteria" rows={3} /></Field>
            <div><SubmitButton pendingText={t.common.saving}>{tr.addPhase}</SubmitButton></div>
          </form>
        </details>
      )}
    </Card>
  );
}

function StatusButton({ athleteId, phaseId, status, label }: { athleteId: string; phaseId: string; status: string; label: string }) {
  return (
    <form action={setPhaseStatus}>
      <input type="hidden" name="athlete_id" value={athleteId} />
      <input type="hidden" name="phase_id" value={phaseId} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">{label}</button>
    </form>
  );
}

function PhaseExercises({ phase, items, athleteId, isAthlete, editable, t }: {
  phase: RtpPhase; items: RtpExercise[]; athleteId: string; isAthlete: boolean; editable: boolean; t: Dictionary;
}) {
  const tr = t.rehab;
  if (items.length === 0 && !editable) return null;
  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{tr.exercises}</h4>
      <ul className="mt-1 divide-y divide-line">
        {items.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>
              <span className="font-medium">{e.name}</span>
              {e.prescription && <span className="text-ink-soft"> · {e.prescription}</span>}
              {e.times_done > 0 && <span className="num text-xs text-muted"> · {tr.timesDone.replace("{n}", String(e.times_done))}</span>}
            </span>
            {isAthlete && phase.status === "in_progress" && (
              <form action={logExercise}>
                <input type="hidden" name="exercise_id" value={e.id} />
                <button type="submit" className="rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas">{tr.logDone}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {editable && phase.status !== "cleared" && (
        <form action={addExercise} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="athlete_id" value={athleteId} />
          <input type="hidden" name="phase_id" value={phase.id} />
          <label className="sr-only" htmlFor={`ex-name-${phase.id}`}>{tr.exerciseName}</label>
          <Input id={`ex-name-${phase.id}`} name="name" required maxLength={160} placeholder={tr.exerciseName} className="max-w-56" />
          <label className="sr-only" htmlFor={`ex-rx-${phase.id}`}>{tr.prescription}</label>
          <Input id={`ex-rx-${phase.id}`} name="prescription" maxLength={1000} placeholder={tr.prescription} className="max-w-56" />
          <SubmitButton pendingText={t.common.saving} variant="secondary">{tr.addExercise}</SubmitButton>
        </form>
      )}
    </div>
  );
}
