import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, Checkbox, Field, FlashMessage, Input, PageHeader, Select, Textarea, cx } from "@/components/ui";
import { ConfirmSubmit, PrintButton, SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import { CYCLE_LEVELS, EXERCISE_CATEGORIES, PROGRAM_TYPES, SESSION_SECTIONS, type SessionSection } from "@/lib/catalog";
import { isUuid } from "@/lib/forms";
import type { Dictionary } from "@/lib/i18n";
import type { SessionExercise, TrainingProgram, TrainingSession } from "@/lib/types";
import {
  addPhase, addSession, addSessionExercise, assignProgram, cancelAssignment, copySession, deletePhase, deleteSession,
  deleteSessionExercise, duplicateProgram, duplicateWeek, moveSessionExercise, saveVersion, updateProgram,
  updateSession, updateSessionExercise,
} from "../actions";

function prescription(e: SessionExercise, t: Dictionary) {
  const parts: string[] = [];
  if (e.sets && e.reps) parts.push(`${e.sets} × ${e.reps}`);
  else if (e.sets) parts.push(`${e.sets} ${t.training.sets.toLowerCase()}`);
  else if (e.reps) parts.push(`${e.reps} ${t.training.reps.toLowerCase()}`);
  if (e.duration_s) parts.push(`${e.duration_s}s`);
  if (e.distance_m) parts.push(`${e.distance_m} m`);
  if (e.load_kg != null) parts.push(`${e.load_kg} kg`);
  if (e.percent_1rm != null) parts.push(`${e.percent_1rm}% 1RM`);
  if (e.rpe != null) parts.push(`RPE ${e.rpe}`);
  if (e.rir != null) parts.push(`RIR ${e.rir}`);
  if (e.tempo) parts.push(`${t.training.tempo} ${e.tempo}`);
  if (e.rest_s != null) parts.push(`${t.training.rest.split(" ")[0]} ${e.rest_s}s`);
  if (e.intensity_target) parts.push(e.intensity_target);
  return parts.join(" · ");
}

function ExerciseFields({ t, e }: { t: Dictionary; e?: SessionExercise }) {
  const tt = t.training;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Field label={tt.section}>
        <Select name="section" defaultValue={e?.section ?? "strength"}>
          {SESSION_SECTIONS.map((s) => <option key={s} value={s}>{tt.sections[s]}</option>)}
        </Select>
      </Field>
      <Field label={tt.sets}><Input name="sets" type="number" min={1} max={50} defaultValue={e?.sets ?? ""} /></Field>
      <Field label={tt.reps}><Input name="reps" defaultValue={e?.reps ?? ""} placeholder="5 / 8-10 / AMRAP" /></Field>
      <Field label={tt.load}><Input name="load_kg" type="number" step="0.5" min={0} defaultValue={e?.load_kg ?? ""} /></Field>
      <Field label={tt.pct1rm}><Input name="percent_1rm" type="number" step="0.5" min={0} max={120} defaultValue={e?.percent_1rm ?? ""} /></Field>
      <Field label={tt.rpe}><Input name="rpe" type="number" step="0.5" min={0} max={10} defaultValue={e?.rpe ?? ""} /></Field>
      <Field label={tt.rir}><Input name="rir" type="number" min={0} max={10} defaultValue={e?.rir ?? ""} /></Field>
      <Field label={tt.rest}><Input name="rest_s" type="number" min={0} defaultValue={e?.rest_s ?? ""} /></Field>
      <Field label={tt.tempo}><Input name="tempo" defaultValue={e?.tempo ?? ""} placeholder="3-1-X-0" /></Field>
      <Field label={tt.durationS}><Input name="duration_s" type="number" min={1} defaultValue={e?.duration_s ?? ""} /></Field>
      <Field label={tt.distance}><Input name="distance_m" type="number" step="0.5" min={0} defaultValue={e?.distance_m ?? ""} /></Field>
      <Field label={tt.intensity}><Input name="intensity_target" defaultValue={e?.intensity_target ?? ""} /></Field>
      <Field label={tt.cues} className="col-span-2"><Input name="cues" defaultValue={e?.cues ?? ""} /></Field>
      <Field label={tt.modifications} className="col-span-2"><Input name="modifications" defaultValue={e?.modifications ?? ""} /></Field>
    </div>
  );
}

export default async function ProgramPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile, t } = await requireProfile();
  if (!isUuid(id)) notFound();
  const { data } = await supabase.from("training_programs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const program = data as TrainingProgram;
  const isOwner = program.coach_id === user.id;
  const tt = t.training;
  const week = Math.min(program.num_weeks, Math.max(1, Number(sp.week) || 1));

  const [{ data: phases }, { data: sessionsData }, { data: assignments }, { data: versions }] = await Promise.all([
    supabase.from("program_phases").select("*").eq("program_id", id).order("start_week"),
    supabase.from("training_sessions").select("*").eq("program_id", id).order("week_number").order("day_number").order("created_at"),
    supabase.from("program_assignments").select("id, athlete_id, start_date, status, athletes(full_name)").eq("program_id", id).eq("status", "active"),
    isOwner ? supabase.from("program_versions").select("id, version, note, created_at").eq("program_id", id).order("version", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
  ]);
  const sessions = (sessionsData ?? []) as TrainingSession[];
  const weekSessions = sessions.filter((s) => s.week_number === week);
  const { data: exData } = weekSessions.length
    ? await supabase.from("session_exercises").select("*").in("session_id", weekSessions.map((s) => s.id)).order("position")
    : { data: [] };
  const exercisesBySession = new Map<string, SessionExercise[]>();
  ((exData ?? []) as SessionExercise[]).forEach((e) => exercisesBySession.set(e.session_id, [...(exercisesBySession.get(e.session_id) ?? []), e]));
  const sessionCountByWeek = new Map<number, number>();
  sessions.forEach((s) => sessionCountByWeek.set(s.week_number, (sessionCountByWeek.get(s.week_number) ?? 0) + 1));

  // Owner-only data for editing and assignment.
  const [libRes, athletesRes, teamsRes, completionsRes] = isOwner
    ? await Promise.all([
        supabase.from("exercises").select("id, name, category").eq("archived", false).order("name").limit(1000),
        supabase.from("athletes").select("id, full_name").eq("status", "active").order("full_name").limit(500),
        supabase.from("teams").select("id, name").eq("owner_id", user.id).eq("status", "active").order("name"),
        sessions.length
          ? supabase.from("workout_completions").select("athlete_id, session_id, status").in("session_id", sessions.map((s) => s.id))
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const library = (libRes.data ?? []) as { id: string; name: string; category: string }[];
  const assignedIds = new Set((assignments ?? []).map((a) => a.athlete_id));
  const assignable = ((athletesRes.data ?? []) as { id: string; full_name: string }[]).filter((a) => !assignedIds.has(a.id));
  const completedBy = new Map<string, number>();
  ((completionsRes.data ?? []) as { athlete_id: string; status: string }[]).forEach((c) => {
    if (c.status !== "skipped") completedBy.set(c.athlete_id, (completedBy.get(c.athlete_id) ?? 0) + 1);
  });

  const myAthleteId = profile.role === "athlete"
    ? ((await supabase.from("athletes").select("id").eq("user_id", user.id).maybeSingle()).data?.id as string | undefined)
    : undefined;

  const hidden = (extra: Record<string, string | number> = {}) => (
    <>
      <input type="hidden" name="program_id" value={id} />
      <input type="hidden" name="week" value={week} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );

  return (
    <>
      <PageHeader
        title={program.title}
        subtitle={[tt.types[program.program_type as keyof typeof tt.types], program.sport, program.goal].filter(Boolean).join(" · ")}
        crumbs={[{ href: "/training", label: profile.role === "athlete" ? tt.myTitle : tt.title }]}
        actions={
          <>
            <PrintButton label={t.common.print} />
            {isOwner && (
              <>
                <form action={duplicateProgram}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton variant="secondary">{tt.duplicateProgram}</SubmitButton>
                </form>
                <form action={duplicateProgram}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="as_template" value="1" />
                  <input type="hidden" name="title" value={`${program.title} — template`} />
                  <SubmitButton variant="secondary">{tt.template}</SubmitButton>
                </form>
              </>
            )}
          </>
        }
      />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone={program.status === "active" ? "green" : program.status === "archived" ? "gray" : "amber"}>{tt.statuses[program.status]}</Badge>
        {program.is_template && <Badge tone="blue">{tt.templates}</Badge>}
        {program.ai_generated && <Badge tone="amber">AI draft</Badge>}
        <Badge>v{program.version}</Badge>
      </div>
      {isOwner && (assignments ?? []).length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{tt.assignedEditWarning}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Phases strip */}
          {(phases ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(phases ?? []).map((ph) => (
                <div key={ph.id} className={cx("rounded-lg border px-3 py-2 text-xs", week >= ph.start_week && week <= ph.end_week ? "border-brand-300 bg-brand-50" : "border-line bg-white")}>
                  <div className="font-medium text-ink">{ph.name} <span className="text-muted">({tt.cycles[ph.cycle_level as keyof typeof tt.cycles]})</span></div>
                  <div className="num text-muted">{t.common.week} {ph.start_week}–{ph.end_week}</div>
                </div>
              ))}
            </div>
          )}

          {/* Week selector */}
          <nav className="no-print flex gap-1 overflow-x-auto pb-1" aria-label={t.common.week}>
            {Array.from({ length: program.num_weeks }, (_, i) => i + 1).map((w) => (
              <Link
                key={w}
                href={`/training/${id}?week=${w}`}
                className={cx("num shrink-0 rounded-lg border px-3 py-1.5 text-sm", w === week ? "border-brand-500 bg-brand-600 text-white" : "border-line bg-white text-ink-soft hover:border-brand-300")}
              >
                {t.common.week} {w}{sessionCountByWeek.get(w) ? <span className="ms-1 opacity-70">({sessionCountByWeek.get(w)})</span> : null}
              </Link>
            ))}
          </nav>

          {weekSessions.length === 0 && <Card><p className="text-sm text-muted">{tt.noSessions}</p></Card>}

          {weekSessions.map((s) => {
            const exs = exercisesBySession.get(s.id) ?? [];
            return (
              <Card
                key={s.id}
                title={<span id={`s-${s.id}`}>{t.common.day} {s.day_number} · {s.title}{s.planned_duration_min ? <span className="font-normal text-muted"> · {s.planned_duration_min} {t.common.min}</span> : null}</span>}
                action={myAthleteId && <ButtonLink className="px-2.5 py-1 text-xs" href={`/training/session/${s.id}?athlete=${myAthleteId}`}>{tt.log}</ButtonLink>}
              >
                {s.notes && <p className="mb-3 whitespace-pre-line text-sm text-ink-soft">{s.notes}</p>}
                {exs.length === 0 ? <p className="text-sm text-muted">—</p> : (
                  <ol className="divide-y divide-line">
                    {exs.map((e, idx) => (
                      <li key={e.id} className="py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="num text-xs text-muted">{idx + 1}.</span>
                              {e.exercise_id ? <Link href={`/exercises/${e.exercise_id}`} className="font-medium hover:text-brand-700">{e.exercise_name}</Link> : <span className="font-medium">{e.exercise_name}</span>}
                              <Badge>{tt.sections[e.section as SessionSection]}</Badge>
                            </div>
                            <div className="num mt-0.5 text-sm text-ink-soft">{prescription(e, t) || "—"}</div>
                            {(e.cues || e.modifications) && <div className="mt-0.5 text-xs text-muted">{[e.cues, e.modifications].filter(Boolean).join(" · ")}</div>}
                          </div>
                          {isOwner && (
                            <div className="flex shrink-0 items-center gap-1">
                              <form action={moveSessionExercise}>{hidden({ id: e.id, dir: -1 })}<button className="rounded px-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label={tt.moveUp} disabled={idx === 0}>↑</button></form>
                              <form action={moveSessionExercise}>{hidden({ id: e.id, dir: 1 })}<button className="rounded px-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label={tt.moveDown} disabled={idx === exs.length - 1}>↓</button></form>
                              <form action={deleteSessionExercise}>{hidden({ id: e.id })}<button className="rounded px-1.5 text-red-700 hover:bg-red-50" aria-label={t.common.remove}>×</button></form>
                            </div>
                          )}
                        </div>
                        {isOwner && (
                          <details className="no-print mt-2">
                            <summary className="cursor-pointer text-xs text-brand-700">{t.common.edit}</summary>
                            <form action={updateSessionExercise} className="mt-2 space-y-2 rounded-lg bg-canvas p-3">
                              {hidden({ id: e.id })}
                              <ExerciseFields t={t} e={e} />
                              <SubmitButton variant="secondary" className="text-xs">{t.common.save}</SubmitButton>
                            </form>
                          </details>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {isOwner && (
                  <div className="no-print mt-4 space-y-2 border-t border-line pt-3">
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-brand-700">+ {tt.addExercise}</summary>
                      <form action={addSessionExercise} className="mt-3 space-y-3">
                        {hidden({ session_id: s.id })}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field label={tt.exercise}>
                            <Select name="exercise_id" defaultValue="">
                              <option value="">{tt.pickExercise}</option>
                              {EXERCISE_CATEGORIES.map((c) => {
                                const items = library.filter((l) => l.category === c);
                                return items.length ? (
                                  <optgroup key={c} label={t.exercises.categories[c]}>
                                    {items.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                  </optgroup>
                                ) : null;
                              })}
                            </Select>
                          </Field>
                          <Field label={tt.customName}><Input name="exercise_name" maxLength={160} /></Field>
                        </div>
                        <ExerciseFields t={t} />
                        <SubmitButton variant="secondary">{tt.addExercise}</SubmitButton>
                      </form>
                    </details>
                    <details>
                      <summary className="cursor-pointer text-xs text-ink-soft">{t.common.edit} / {tt.duplicateSession}</summary>
                      <div className="mt-2 grid gap-3 rounded-lg bg-canvas p-3 lg:grid-cols-2">
                        <form action={updateSession} className="space-y-2">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="program_id" value={id} />
                          <Field label={tt.sessionTitle}><Input name="title" defaultValue={s.title} required /></Field>
                          <div className="grid grid-cols-3 gap-2">
                            <Field label={t.common.week}><Input name="week_number" type="number" min={1} max={program.num_weeks} defaultValue={s.week_number} /></Field>
                            <Field label={t.common.day}><Input name="day_number" type="number" min={1} max={7} defaultValue={s.day_number} /></Field>
                            <Field label={t.common.min}><Input name="planned_duration_min" type="number" min={1} defaultValue={s.planned_duration_min ?? ""} /></Field>
                          </div>
                          <Field label={t.common.notes}><Textarea name="notes" rows={2} defaultValue={s.notes ?? ""} /></Field>
                          <SubmitButton variant="secondary" className="text-xs">{t.common.save}</SubmitButton>
                        </form>
                        <div className="space-y-3">
                          <form action={copySession} className="space-y-2">
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="program_id" value={id} />
                            <div className="text-xs font-medium text-ink">{tt.copyTo}</div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input name="target_week" type="number" min={1} max={program.num_weeks} defaultValue={Math.min(program.num_weeks, week + 1)} aria-label={t.common.week} />
                              <Input name="target_day" type="number" min={1} max={7} defaultValue={s.day_number} aria-label={t.common.day} />
                            </div>
                            <SubmitButton variant="secondary" className="text-xs">{tt.duplicateSession}</SubmitButton>
                          </form>
                          <form action={deleteSession}>
                            {hidden({ id: s.id })}
                            <ConfirmSubmit variant="danger" className="text-xs" message={`${t.common.delete} "${s.title}"?`}>{t.common.delete}</ConfirmSubmit>
                          </form>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </Card>
            );
          })}

          {isOwner && (
            <div className="no-print grid gap-4 lg:grid-cols-2">
              <Card title={tt.addSession}>
                <form action={addSession} className="space-y-3">
                  <input type="hidden" name="program_id" value={id} />
                  <input type="hidden" name="week_number" value={week} />
                  <Field label={tt.sessionTitle}><Input name="title" required maxLength={160} placeholder="Lower body strength" /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t.common.day}>
                      <Select name="day_number" defaultValue="1">{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{t.common.day} {d}</option>)}</Select>
                    </Field>
                    <Field label={tt.duration}><Input name="planned_duration_min" type="number" min={1} max={600} /></Field>
                  </div>
                  <SubmitButton>{tt.addSession}</SubmitButton>
                </form>
              </Card>
              <Card title={tt.duplicateWeek}>
                <form action={duplicateWeek} className="space-y-3">
                  <input type="hidden" name="program_id" value={id} />
                  <input type="hidden" name="from_week" value={week} />
                  <Field label={tt.duplicateWeekTo}><Input name="to_week" type="number" min={1} max={104} defaultValue={week + 1} /></Field>
                  <SubmitButton variant="secondary" disabled={weekSessions.length === 0}>{tt.duplicateWeek}</SubmitButton>
                </form>
              </Card>
            </div>
          )}
        </div>

        {isOwner && (
          <div className="no-print space-y-6">
            <Card title={tt.assign}>
              <form action={assignProgram} className="space-y-3">
                <input type="hidden" name="program_id" value={id} />
                <Field label={t.nav.athletes}>
                  <Select name="athlete_ids" multiple size={Math.min(8, Math.max(3, assignable.length))}>
                    {assignable.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                  </Select>
                </Field>
                {(teamsRes.data ?? []).length > 0 && (
                  <Field label={tt.assignTeam}>
                    <Select name="team_id" defaultValue="">
                      <option value="">—</option>
                      {(teamsRes.data ?? []).map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                    </Select>
                  </Field>
                )}
                <Field label={tt.startDate}><Input type="date" name="start_date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
                <SubmitButton>{tt.assignTo}</SubmitButton>
              </form>
              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{tt.assigned}</div>
                {(assignments ?? []).length === 0 ? <p className="text-sm text-muted">{tt.notAssigned}</p> : (
                  <ul className="space-y-2 text-sm">
                    {(assignments ?? []).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2">
                        <div>
                          <Link href={`/athletes/${a.athlete_id}`} className="font-medium hover:text-brand-700">{(a.athletes as unknown as { full_name: string } | null)?.full_name}</Link>
                          <div className="num text-xs text-muted">{tt.planVsDone}: {completedBy.get(a.athlete_id) ?? 0}/{sessions.length}</div>
                        </div>
                        <form action={cancelAssignment}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="program_id" value={id} />
                          <ConfirmSubmit variant="ghost" className="px-2 py-1 text-xs" message={`${tt.cancelAssignment}?`}>{t.common.remove}</ConfirmSubmit>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card title={tt.phases}>
              <ul className="mb-4 space-y-2 text-sm">
                {(phases ?? []).map((ph) => (
                  <li key={ph.id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{ph.name}</div>
                      <div className="text-xs text-muted">{tt.cycles[ph.cycle_level as keyof typeof tt.cycles]} · {t.common.week} {ph.start_week}–{ph.end_week}</div>
                      {ph.objective && <div className="text-xs text-ink-soft">{ph.objective}</div>}
                    </div>
                    <form action={deletePhase}>
                      <input type="hidden" name="id" value={ph.id} />
                      <input type="hidden" name="program_id" value={id} />
                      <button className="text-xs text-red-700 hover:underline">{t.common.remove}</button>
                    </form>
                  </li>
                ))}
              </ul>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-700">+ {tt.addPhase}</summary>
                <form action={addPhase} className="mt-3 space-y-2">
                  <input type="hidden" name="program_id" value={id} />
                  <Field label={tt.phaseName}><Input name="name" required placeholder="General preparation" /></Field>
                  <Field label={tt.cycleLevel}>
                    <Select name="cycle_level" defaultValue="mesocycle">{CYCLE_LEVELS.map((c) => <option key={c} value={c}>{tt.cycles[c]}</option>)}</Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={tt.startWeek}><Input name="start_week" type="number" min={1} max={program.num_weeks} defaultValue={week} /></Field>
                    <Field label={tt.endWeek}><Input name="end_week" type="number" min={1} max={program.num_weeks} defaultValue={program.num_weeks} /></Field>
                  </div>
                  <Field label={tt.objective}><Textarea name="objective" rows={2} /></Field>
                  <SubmitButton variant="secondary">{tt.addPhase}</SubmitButton>
                </form>
              </details>
            </Card>

            <Card title={t.common.edit}>
              <form action={updateProgram} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <Field label={tt.programTitle}><Input name="title" defaultValue={program.title} required /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={tt.type}>
                    <Select name="program_type" defaultValue={program.program_type}>{PROGRAM_TYPES.map((p) => <option key={p} value={p}>{tt.types[p]}</option>)}</Select>
                  </Field>
                  <Field label={t.common.status}>
                    <Select name="status" defaultValue={program.status}>{(["draft", "active", "archived"] as const).map((s) => <option key={s} value={s}>{tt.statuses[s]}</option>)}</Select>
                  </Field>
                  <Field label={tt.weeks}><Input name="num_weeks" type="number" min={1} max={104} defaultValue={program.num_weeks} /></Field>
                  <Field label={tt.sport}><Input name="sport" defaultValue={program.sport ?? ""} /></Field>
                </div>
                <Field label={tt.goal}><Input name="goal" defaultValue={program.goal ?? ""} /></Field>
                <Field label={tt.description}><Textarea name="description" rows={2} defaultValue={program.description ?? ""} /></Field>
                <Checkbox name="is_template" label={tt.template} defaultChecked={program.is_template} />
                <div><SubmitButton variant="secondary">{t.common.save}</SubmitButton></div>
              </form>
            </Card>

            <Card title={tt.versions}>
              <form action={saveVersion} className="mb-4 flex gap-2">
                <input type="hidden" name="program_id" value={id} />
                <Input name="note" placeholder={tt.versionNote} maxLength={300} />
                <SubmitButton variant="secondary" className="shrink-0">{tt.saveVersion}</SubmitButton>
              </form>
              {(versions ?? []).length === 0 ? <p className="text-sm text-muted">{tt.noVersions}</p> : (
                <ul className="space-y-1.5 text-sm">
                  {(versions ?? []).map((v) => (
                    <li key={v.id} className="flex justify-between gap-2">
                      <span><span className="num font-medium">v{v.version}</span>{v.note && <span className="text-ink-soft"> · {v.note}</span>}</span>
                      <span className="num text-xs text-muted">{new Date(v.created_at).toLocaleDateString(profile.locale)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
