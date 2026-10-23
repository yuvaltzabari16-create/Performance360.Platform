import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, Checkbox, Field, FlashMessage, Input, PageHeader, Select, Textarea, cx } from "@/components/ui";
import { ConfirmSubmit, PrintButton, SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import { CYCLE_LEVELS, PROGRAM_TYPES, youtubeThumbnail, type SessionSection } from "@/lib/catalog";
import { isUuid } from "@/lib/forms";
import { ChipRow } from "@/components/training/chips";
import type { SessionExercise, TrainingProgram, TrainingSession } from "@/lib/types";
import { Builder, type LibraryExercise } from "./Builder";
import {
  addPhase, addSession, assignProgram, cancelAssignment, copySession, deletePhase, deleteSession,
  duplicateProgram, duplicateWeek, saveVersion, updateProgram, updateSession,
} from "../actions";

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
  const sessionParam = sp.session && isUuid(sp.session) ? sp.session : null;
  const week = Math.min(program.num_weeks, Math.max(1, Number(sp.week) || 1));

  const [{ data: phases }, { data: sessionsData }, { data: assignments }, { data: versions }] = await Promise.all([
    supabase.from("program_phases").select("*").eq("program_id", id).order("start_week"),
    supabase.from("training_sessions").select("*").eq("program_id", id).order("week_number").order("day_number").order("created_at"),
    supabase.from("program_assignments").select("id, athlete_id, start_date, status, athletes(full_name)").eq("program_id", id).eq("status", "active"),
    isOwner ? supabase.from("program_versions").select("id, version, note, created_at").eq("program_id", id).order("version", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
  ]);
  const sessions = (sessionsData ?? []) as TrainingSession[];
  const weekSessions = sessions.filter((s) => s.week_number === week);
  const selected = weekSessions.find((s) => s.id === sessionParam) ?? weekSessions[0];
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
        supabase.from("exercises").select("id, name, category, thumbnail_url, video_url").eq("archived", false).order("name").limit(1000),
        supabase.from("athletes").select("id, full_name").eq("status", "active").order("full_name").limit(500),
        supabase.from("teams").select("id, name").eq("owner_id", user.id).eq("status", "active").order("name"),
        sessions.length
          ? supabase.from("workout_completions").select("athlete_id, session_id, status").in("session_id", sessions.map((s) => s.id))
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const library: LibraryExercise[] = ((libRes.data ?? []) as { id: string; name: string; category: string; thumbnail_url: string | null; video_url: string | null }[])
    .map((l) => ({ id: l.id, name: l.name, category: l.category, thumb: l.thumbnail_url ?? youtubeThumbnail(l.video_url) }));
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

      <div className="grid gap-6 xl:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Program structure (weeks and sessions) */}
        <aside className="no-print hidden xl:block">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-3">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{tt.builder.structure}</h3>
            <ol className="space-y-3">
              {Array.from({ length: program.num_weeks }, (_, i) => i + 1).map((w) => {
                const ws = sessions.filter((s) => s.week_number === w);
                return (
                  <li key={w}>
                    <Link href={`/training/${id}?week=${w}`} className={cx("block rounded-lg px-2 py-1 text-sm font-medium", w === week ? "text-brand-700" : "text-ink-soft hover:text-ink")}>
                      {t.common.week} {w}
                    </Link>
                    {ws.length > 0 && (
                      <ul className="ms-2 mt-1 space-y-0.5 border-s border-line ps-2">
                        {ws.map((s) => (
                          <li key={s.id}>
                            <Link
                              href={`/training/${id}?week=${w}&session=${s.id}`}
                              className={cx("block truncate rounded-md px-2 py-1 text-xs", w === week && s.id === selected?.id ? "bg-brand-50 font-semibold text-brand-800" : "text-muted hover:bg-canvas")}
                            >
                              {t.common.day} {s.day_number} · {s.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
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


          {/* Week selector (small screens; wide screens use the structure list) */}
          <nav className="no-print flex gap-1 overflow-x-auto pb-1 xl:hidden" aria-label={t.common.week}>
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

          {/* Session tabs */}
          {weekSessions.length > 0 && isOwner && (
            <nav className="no-print flex gap-1 overflow-x-auto pb-1" aria-label={tt.builder.selectSession}>
              {weekSessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/training/${id}?week=${week}&session=${s.id}`}
                  aria-current={s.id === selected?.id ? "page" : undefined}
                  className={cx("shrink-0 rounded-lg border px-3 py-1.5 text-sm", s.id === selected?.id ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-line bg-white text-ink-soft hover:border-brand-300")}
                >
                  {t.common.day} {s.day_number} · <bdi>{s.title}</bdi>
                </Link>
              ))}
            </nav>
          )}

          {/* Owner: the builder for the selected session */}
          {isOwner && selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink">
                  {t.common.day} {selected.day_number} · <bdi>{selected.title}</bdi>
                  {selected.planned_duration_min ? <span className="text-sm font-normal text-muted"> · {selected.planned_duration_min} {t.common.min}</span> : null}
                </h2>
                {myAthleteId && <ButtonLink className="px-2.5 py-1 text-xs" href={`/training/session/${selected.id}?athlete=${myAthleteId}`}>{tt.log}</ButtonLink>}
              </div>
              {selected.notes && <p className="whitespace-pre-line text-sm text-ink-soft">{selected.notes}</p>}
              <Builder
                key={selected.id}
                programId={id}
                session={{ id: selected.id, title: selected.title }}
                exercises={exercisesBySession.get(selected.id) ?? []}
                library={library}
                tt={tt}
                categories={t.exercises.categories}
                labels={{ remove: t.common.remove, search: t.common.search }}
              />
              <div className="no-print">
                    <details>
                      <summary className="cursor-pointer text-xs text-ink-soft">{t.common.edit} / {tt.duplicateSession}</summary>
                      <div className="mt-2 grid gap-3 rounded-lg bg-canvas p-3 lg:grid-cols-2">
                        <form action={updateSession} className="space-y-2">
                          <input type="hidden" name="id" value={selected.id} />
                          <input type="hidden" name="program_id" value={id} />
                          <Field label={tt.sessionTitle}><Input name="title" defaultValue={selected.title} required /></Field>
                          <div className="grid grid-cols-3 gap-2">
                            <Field label={t.common.week}><Input name="week_number" type="number" min={1} max={program.num_weeks} defaultValue={selected.week_number} /></Field>
                            <Field label={t.common.day}><Input name="day_number" type="number" min={1} max={7} defaultValue={selected.day_number} /></Field>
                            <Field label={t.common.min}><Input name="planned_duration_min" type="number" min={1} defaultValue={selected.planned_duration_min ?? ""} /></Field>
                          </div>
                          <Field label={t.common.notes}><Textarea name="notes" rows={2} defaultValue={selected.notes ?? ""} /></Field>
                          <SubmitButton variant="secondary" className="text-xs">{t.common.save}</SubmitButton>
                        </form>
                        <div className="space-y-3">
                          <form action={copySession} className="space-y-2">
                            <input type="hidden" name="id" value={selected.id} />
                            <input type="hidden" name="program_id" value={id} />
                            <div className="text-xs font-medium text-ink">{tt.copyTo}</div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input name="target_week" type="number" min={1} max={program.num_weeks} defaultValue={Math.min(program.num_weeks, week + 1)} aria-label={t.common.week} />
                              <Input name="target_day" type="number" min={1} max={7} defaultValue={selected.day_number} aria-label={t.common.day} />
                            </div>
                            <SubmitButton variant="secondary" className="text-xs">{tt.duplicateSession}</SubmitButton>
                          </form>
                          <form action={deleteSession}>
                            {hidden({ id: selected.id })}
                            <ConfirmSubmit variant="danger" className="text-xs" message={`${t.common.delete} "${selected.title}"?`}>{t.common.delete}</ConfirmSubmit>
                          </form>
                        </div>
                      </div>
                    </details>

              </div>
            </div>
          )}

          {/* Athletes and read-only viewers: sessions as blocks with prescription chips */}
          {!isOwner && weekSessions.map((s) => {
            const exs = exercisesBySession.get(s.id) ?? [];
            const sections = [...new Set(exs.map((e) => e.section as SessionSection))];
            return (
              <Card
                key={s.id}
                title={<span id={`s-${s.id}`}>{t.common.day} {s.day_number} · {s.title}{s.planned_duration_min ? <span className="font-normal text-muted"> · {s.planned_duration_min} {t.common.min}</span> : null}</span>}
                action={myAthleteId && <ButtonLink className="px-2.5 py-1 text-xs" href={`/training/session/${s.id}?athlete=${myAthleteId}`}>{tt.log}</ButtonLink>}
              >
                {s.notes && <p className="mb-3 whitespace-pre-line text-sm text-ink-soft">{s.notes}</p>}
                {exs.length === 0 ? <p className="text-sm text-muted">—</p> : (
                  <div className="space-y-4">
                    {sections.map((section, bi) => (
                      <section key={section}>
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                          <span className="grid size-5 place-items-center rounded-full bg-brand-50 text-[11px] text-brand-700" aria-hidden>{bi + 1}</span>
                          {tt.sections[section]}
                        </h3>
                        <ol className="space-y-2">
                          {exs.filter((e) => e.section === section).map((e, i) => (
                            <li key={e.id} className="rounded-xl border border-line bg-canvas/60 p-3">
                              <div className="flex items-start gap-3">
                                <span className="grid size-6 shrink-0 place-items-center rounded-md border border-line bg-surface text-xs font-semibold text-ink-soft" aria-hidden>{String.fromCharCode(65 + (i % 26))}</span>
                                <div className="min-w-0 flex-1">
                                  {e.exercise_id ? <Link href={`/exercises/${e.exercise_id}`} className="font-medium hover:text-brand-700"><bdi>{e.exercise_name}</bdi></Link> : <bdi className="font-medium">{e.exercise_name}</bdi>}
                                  <ChipRow e={e} labels={tt.builder.fields} className="mt-2" />
                                  {(e.cues || e.modifications) && <div className="mt-1.5 text-xs text-muted">{[e.cues, e.modifications].filter(Boolean).join(" · ")}</div>}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </section>
                    ))}
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
                  <Field label={tt.sessionTitle}><Input name="title" required maxLength={160} placeholder={t.common.exSession} /></Field>
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
      </div>

        {isOwner && (
          <div className="no-print grid items-start gap-6 lg:grid-cols-2">
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
                  <Field label={tt.phaseName}><Input name="name" required placeholder={t.common.exPhase} /></Field>
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
    </>
  );
}
