import Link from "next/link";
import { DraftTextarea } from "@/components/autosave/DraftTextarea";
import { escapeLike } from "@/lib/security/query";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, Checkbox, DefinitionList, FlashMessage, PageHeader } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { TrendChart } from "@/components/charts/TrendChart";
import { requireProfile } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { ageFromDob, bestTrial, isImprovement, percentChange, sessionLoad, wellnessIndex } from "@/lib/metrics";
import type { Athlete, ReadinessEntry, TestDefinition } from "@/lib/types";
import { displayHeight, displayMass, round } from "@/lib/units";
import { InjurySection } from "@/components/injury/InjurySection";
import { loadInjuries } from "@/lib/injury-data";
import { addNote, deleteNote, endRelationship, setAthleteStatus } from "../actions";
import { addToRoster, removeFromRoster } from "../../team/actions";

export default async function AthletePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile, org, t } = await requireProfile();
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
      ? supabase.from("athletes").select("id").ilike("email", escapeLike(a.email)).neq("id", id).limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  const relationships = rels.data ?? [];
  const myRel = relationships.find((r) => r.coach_id === user.id);
  // Lead access comes from a personal primary relationship or from a lead role on the athlete's team.
  const { data: primaryFlag } = await supabase.rpc("is_primary_coach", { p_athlete: id });
  const isPrimary = primaryFlag === true;
  const { data: rosterRows } = await supabase
    .from("organization_athletes")
    .select("org_id, consent_source, consented_at, organizations(name)")
    .eq("athlete_id", id)
    .eq("status", "active");
  const onMyRoster = Boolean(org && rosterRows?.some((r) => r.org_id === org.org_id));
  const canAddToRoster = Boolean(org && ["head_coach", "head_of_performance", "assistant_coach"].includes(org.org_role) && !a.user_id && !onMyRoster && myRel);
  const canRemoveFromRoster = Boolean(onMyRoster && org && ["head_coach", "head_of_performance"].includes(org.org_role));
  const isPro = profile.role !== "athlete";
  const { injuries, events: injuryEvents } = await loadInjuries(supabase, [id]);
  // Mirrors the database rule: the primary coach or a team physiotherapist on the athlete's roster records clearance.
  const canClear = isPrimary || Boolean(org?.org_role === "physiotherapist" && onMyRoster);

  // Team staff on the athlete's roster teams (visible to the athlete and to colleagues).
  const rosterOrgIds = (rosterRows ?? []).map((r) => r.org_id);
  const { data: teamStaff } = rosterOrgIds.length
    ? await supabase.from("organization_members").select("user_id, org_id, org_role").in("org_id", rosterOrgIds).eq("status", "active").neq("org_role", "director")
    : { data: [] };
  const coachIds = [...new Set([...relationships.map((r) => r.coach_id), ...(teamStaff ?? []).map((m) => m.user_id), ...(notes.data ?? []).map((n) => n.author_id)])];
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
                        <div className="font-medium text-ink"><bdi>{r.def.name}</bdi>{r.side !== "both" && ` · ${t.testing.sides[r.side as "left" | "right"]}`}</div>
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

          <InjurySection
            injuries={injuries}
            events={injuryEvents}
            athleteId={a.id}
            today={new Date().toISOString().slice(0, 10)}
            locale={profile.locale}
            t={t}
            back={`/athletes/${a.id}`}
            professional={isPro}
            canClear={canClear}
          />

          <Card title={ta.notes}>
            <div id="notes" />
            {isPro && (
              <form action={addNote} className="mb-5 space-y-2">
                <input type="hidden" name="athlete_id" value={a.id} />
                <DraftTextarea draftKey={`note:${id}`} restoredLabel={t.settings.draftRestored} name="body" required maxLength={5000} placeholder={ta.addNote} rows={3} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
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
            {relationships.length === 0 && (teamStaff ?? []).length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {(teamStaff ?? []).map((m) => (
                  <li key={`team-${m.user_id}`}>
                    <div className="font-medium"><bdi>{nameOf(m.user_id)}</bdi></div>
                    <div className="text-xs text-muted">{t.orgRoles[m.org_role as keyof typeof t.orgRoles]} · {(rosterRows ?? []).find((r) => r.org_id === m.org_id) && (((rosterRows ?? []).find((r) => r.org_id === m.org_id)?.organizations as unknown as { name: string } | null)?.name)}</div>
                  </li>
                ))}
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

          {((rosterRows ?? []).length > 0 || canAddToRoster) && (
            <Card title={t.team.onRoster}>
              {(rosterRows ?? []).map((r) => (
                <div key={r.org_id} className="mb-3 text-sm">
                  <div className="font-medium"><bdi>{(r.organizations as unknown as { name: string } | null)?.name}</bdi></div>
                  <div className="text-xs text-muted">{r.consent_source === "athlete" ? t.team.consentAthlete : t.team.consentStaff} · <span className="num">{r.consented_at.slice(0, 10)}</span></div>
                </div>
              ))}
              {isSelf && <ButtonLink variant="secondary" href="/connect">{t.team.leave}</ButtonLink>}
              {canRemoveFromRoster && (
                <form action={removeFromRoster}>
                  <input type="hidden" name="athlete_id" value={a.id} />
                  <input type="hidden" name="back" value={`/athletes/${a.id}`} />
                  <ConfirmSubmit variant="danger" message={t.team.removeFromRosterConfirm}>{t.team.removeFromRoster}</ConfirmSubmit>
                </form>
              )}
              {canAddToRoster && (
                <form action={addToRoster} className="space-y-2">
                  <input type="hidden" name="athlete_id" value={a.id} />
                  <p className="text-xs text-muted">{t.team.addToRosterHelp}</p>
                  <SubmitButton variant="secondary">{t.team.addToRoster}</SubmitButton>
                </form>
              )}
            </Card>
          )}

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
