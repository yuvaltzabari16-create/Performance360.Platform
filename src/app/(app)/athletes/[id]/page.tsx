import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, Checkbox, DefinitionList, FlashMessage, PageHeader, Textarea } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { TrendChart } from "@/components/charts/TrendChart";
import { requireProfile } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { ageFromDob, bestTrial, isImprovement, percentChange, sessionLoad, wellnessIndex } from "@/lib/metrics";
import type { Athlete, ReadinessEntry, TestDefinition } from "@/lib/types";
import { displayHeight, displayMass, round } from "@/lib/units";
import { addNote, deleteNote, endRelationship, setAthleteStatus } from "../actions";

export default async function AthletePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile, t } = await requireProfile();
  if (!isUuid(id)) notFound();

  const { data } = await supabase.from("athletes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Athlete;
  const isSelf = a.user_id === user.id;
  const ta = t.athletes;

  const [rels, assignments, completions, results, readiness, notes, dupes] = await Promise.all([
    supabase.from("coach_athlete_relationships").select("id, coach_id, kind, status, started_at").eq("athlete_id", id).eq("status", "active"),
    supabase.from("program_assignments").select("id, start_date, status, training_programs(id, title, num_weeks)").eq("athlete_id", id).eq("status", "active"),
    supabase.from("workout_completions").select("id, completed_on, status, session_rpe, duration_min, training_sessions(title)").eq("athlete_id", id).order("completed_on", { ascending: false }).limit(8),
    supabase.from("test_results").select("id, test_id, tested_on, side, trials, method").eq("athlete_id", id).order("tested_on", { ascending: false }).limit(200),
    supabase.from("readiness_entries").select("*").eq("athlete_id", id).order("entry_date", { ascending: false }).limit(28),
    supabase.from("athlete_notes").select("id, body, shared_with_athlete, created_at, author_id").eq("athlete_id", id).order("created_at", { ascending: false }).limit(30),
    a.email && !isSelf
      ? supabase.from("athletes").select("id").ilike("email", a.email).neq("id", id).limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  const relationships = rels.data ?? [];
  const myRel = relationships.find((r) => r.coach_id === user.id);
  const isPrimary = myRel?.kind === "primary";
  const isPro = profile.role !== "athlete";

  const coachIds = relationships.map((r) => r.coach_id);
  const { data: coachProfiles } = coachIds.length
    ? await supabase.from("profiles").select("id, full_name, role").in("id", coachIds)
    : { data: [] };
  const nameOf = (uid: string) => coachProfiles?.find((p) => p.id === uid)?.full_name ?? "—";

  // Latest result per test & side with change from the previous one.
  const testIds = [...new Set((results.data ?? []).map((r) => r.test_id))];
  const { data: defs } = testIds.length ? await supabase.from("test_definitions").select("*").in("id", testIds) : { data: [] };
  const defMap = new Map((defs as TestDefinition[] | null ?? []).map((d) => [d.id, d]));
  const latestByTest = new Map<string, { def: TestDefinition; side: string; date: string; best: number | null; prev: number | null; method: string | null }>();
  for (const r of results.data ?? []) {
    const def = defMap.get(r.test_id);
    if (!def) continue;
    const key = `${r.test_id}:${r.side}`;
    const best = bestTrial(r.trials as number[], def.higher_is_better);
    const existing = latestByTest.get(key);
    if (!existing) latestByTest.set(key, { def, side: r.side, date: r.tested_on, best, prev: null, method: r.method });
    else if (existing.prev == null) existing.prev = best;
  }

  const readinessRows = ((readiness.data ?? []) as ReadinessEntry[]).slice().reverse();
  const readinessChart = readinessRows.map((r) => ({ date: r.entry_date.slice(5), index: wellnessIndex(r) == null ? null : round(wellnessIndex(r)!, 2) }));

  const flags = [
    [ta.limitations, a.limitations],
    [ta.modifications, a.training_modifications],
    [ta.rehabStatus, a.rehab_status],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <>
      <PageHeader
        title={a.full_name}
        subtitle={[a.sport, a.position, a.team_name].filter(Boolean).join(" · ") || undefined}
        crumbs={isPro ? [{ href: "/athletes", label: t.athletes.title }] : []}
        actions={
          <>
            {isPro && <ButtonLink variant="secondary" href={`/testing/new?athlete=${a.id}`}>{t.testing.record}</ButtonLink>}
            {(isPrimary || isSelf) && <ButtonLink variant="secondary" href={`/athletes/${a.id}/edit`}>{ta.editProfile}</ButtonLink>}
            {isPrimary && (
              <form action={setAthleteStatus}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="status" value={a.status === "active" ? "archived" : "active"} />
                {a.status === "active"
                  ? <ConfirmSubmit variant="danger" message={ta.archiveConfirm}>{t.common.archive}</ConfirmSubmit>
                  : <SubmitButton variant="secondary">{t.common.restore}</SubmitButton>}
              </form>
            )}
          </>
        }
      />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="mb-4 flex flex-wrap gap-2">
        {a.status === "archived" && <Badge tone="amber">{t.common.archived}</Badge>}
        {a.user_id ? <Badge tone="green">{ta.linked}</Badge> : <Badge>{ta.notLinked}</Badge>}
        {(dupes.data?.length ?? 0) > 0 && <Badge tone="amber">{ta.possibleDuplicate}</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={ta.overview}>
            <DefinitionList
              items={[
                [ta.age, ageFromDob(a.date_of_birth)],
                [ta.level, a.competitive_level],
                [ta.trainingAge, a.training_age_years],
                [ta.dominantSide, a.dominant_side ? ta[a.dominant_side] : null],
                [ta.height, displayHeight(a.height_cm, profile.units)],
                [ta.mass, displayMass(a.body_mass_kg, profile.units)],
                [ta.season, a.current_season],
                [ta.club, a.club],
                [ta.availability, a.training_availability],
                [ta.equipment, a.equipment_availability],
              ]}
            />
          </Card>

          <Card title={ta.latestTests} action={<Link className="text-xs text-brand-700 hover:underline" href={`/testing?athlete=${a.id}`}>{t.testing.history}</Link>}>
            {latestByTest.size === 0 ? (
              <p className="text-sm text-muted">{t.testing.empty}</p>
            ) : (
              <ul className="divide-y divide-line">
                {[...latestByTest.values()].map((r) => {
                  const change = percentChange(r.best, r.prev);
                  const improved = isImprovement(r.best != null && r.prev != null ? r.best - r.prev : null, r.def.higher_is_better);
                  return (
                    <li key={`${r.def.id}${r.side}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <div className="font-medium text-ink">{r.def.name}{r.side !== "both" && ` · ${t.testing.sides[r.side as "left" | "right"]}`}</div>
                        <div className="text-xs text-muted">{r.date}{r.method && ` · ${r.method}`}</div>
                      </div>
                      <div className="text-end">
                        <div className="num font-semibold">{r.best ?? "—"} {r.def.unit}</div>
                        {change != null && (
                          <div className={`num text-xs ${improved ? "text-brand-700" : improved === false ? "text-red-700" : "text-muted"}`}>
                            {change > 0 ? "+" : ""}{round(change, 1)}% {t.testing.fromPrevious.toLowerCase()}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={ta.readinessTrend}>
            {readinessChart.length === 0 ? (
              <p className="text-sm text-muted">{t.readiness.empty}</p>
            ) : (
              <>
                <TrendChart data={readinessChart} series={[{ key: "index", label: t.readiness.index, color: "#23985e" }]} />
                <p className="mt-2 text-xs text-muted">{t.readiness.indexHelp}</p>
              </>
            )}
          </Card>

          <Card title={ta.recentSessions}>
            {(completions.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">{t.training.noHistory}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {(completions.data ?? []).map((c) => {
                  const session = c.training_sessions as unknown as { title: string } | null;
                  const load = sessionLoad(c.session_rpe, c.duration_min);
                  return (
                    <li key={c.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="font-medium">{session?.title ?? "—"}</div>
                        <div className="text-xs text-muted">{c.completed_on}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={c.status === "completed" ? "green" : c.status === "partial" ? "amber" : "gray"}>{t.training[c.status as "completed" | "partial" | "skipped"]}</Badge>
                        {load != null && <span className="num text-xs text-muted">{load} AU</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={ta.notes}>
            <div id="notes" />
            {isPro && (
              <form action={addNote} className="mb-5 space-y-2">
                <input type="hidden" name="athlete_id" value={a.id} />
                <Textarea name="body" required maxLength={5000} placeholder={ta.addNote} />
                <div className="flex items-center justify-between">
                  <Checkbox name="shared" label={ta.shareWithAthlete} />
                  <SubmitButton variant="secondary">{ta.addNote}</SubmitButton>
                </div>
              </form>
            )}
            {(notes.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">{ta.noNotes}</p>
            ) : (
              <ul className="space-y-3">
                {(notes.data ?? []).map((n) => (
                  <li key={n.id} className="rounded-lg bg-canvas p-3 text-sm">
                    <p className="whitespace-pre-line text-ink">{n.body}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted">
                      <span>{new Date(n.created_at).toLocaleDateString(profile.locale)} · {nameOf(n.author_id)} · {n.shared_with_athlete ? ta.shared : ta.private}</span>
                      {n.author_id === user.id && (
                        <form action={deleteNote}>
                          <input type="hidden" name="id" value={n.id} />
                          <input type="hidden" name="athlete_id" value={a.id} />
                          <button className="text-red-700 hover:underline" type="submit">{t.common.delete}</button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={ta.goals}>
            <DefinitionList items={[[ta.shortGoals, a.short_term_goals], [ta.longGoals, a.long_term_goals]]} />
          </Card>

          {flags.length > 0 && (
            <Card title={ta.flags}>
              <ul className="space-y-3 text-sm">
                {flags.map(([k, v]) => (
                  <li key={k} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-medium text-amber-900">{k}</div>
                    <div className="mt-1 whitespace-pre-line text-amber-950">{v}</div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">{ta.healthNote}</p>
            </Card>
          )}

          <Card title={ta.assignedPrograms}>
            {(assignments.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">{t.training.notAssigned}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(assignments.data ?? []).map((as) => {
                  const p = as.training_programs as unknown as { id: string; title: string; num_weeks: number } | null;
                  return p ? (
                    <li key={as.id}>
                      <Link href={`/training/${p.id}`} className="font-medium text-ink hover:text-brand-700">{p.title}</Link>
                      <div className="text-xs text-muted">{t.training.startDate}: {as.start_date} · {p.num_weeks} {t.common.week.toLowerCase()}</div>
                    </li>
                  ) : null;
                })}
              </ul>
            )}
          </Card>

          <Card title={ta.professionals}>
            {relationships.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {relationships.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{nameOf(r.coach_id)}</div>
                      <div className="text-xs text-muted">{r.kind === "primary" ? ta.primary : ta.collaborator} · {r.started_at.slice(0, 10)}</div>
                    </div>
                    {(isSelf || r.coach_id === user.id) && (
                      <form action={endRelationship}>
                        <input type="hidden" name="relationship_id" value={r.id} />
                        <input type="hidden" name="back" value={r.coach_id === user.id ? "/athletes" : `/athletes/${a.id}`} />
                        <ConfirmSubmit variant="ghost" className="px-2 py-1 text-xs" message={ta.endConfirm}>{ta.endConnection}</ConfirmSubmit>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={ta.sections.personal}>
            <DefinitionList
              items={[
                [t.common.email, a.email],
                [ta.phone, a.phone],
                [ta.dob, a.date_of_birth],
                [ta.prefLanguage, a.preferred_language === "he" ? "עברית" : a.preferred_language === "en" ? "English" : null],
                [ta.emergency, a.emergency_contact],
                [ta.injuryHistory, a.injury_history],
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
