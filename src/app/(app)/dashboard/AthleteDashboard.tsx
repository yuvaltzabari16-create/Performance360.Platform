import Link from "next/link";
import { sessionDate } from "@/lib/calendar";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { getMyAthleteId, requireProfile } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";
import { bestTrial } from "@/lib/metrics";
import { missingGuardianConsent } from "@/lib/minors";
import type { TrainingSession } from "@/lib/types";
import { isoDaysAgo } from "./dates";

export async function AthleteDashboard({ t }: { t: Dictionary }) {
  const { supabase, profile } = await requireProfile();
  const td = t.dashboard;
  const athleteId = await getMyAthleteId();
  const today = isoDaysAgo(0);

  if (!athleteId) {
    return (
      <>
        <PageHeader title={`${td.greeting}, ${profile.full_name.split(" ")[0] || ""}`} />
        <EmptyState title={td.notConnected} action={<ButtonLink href="/connect">{td.connectCta}</ButtonLink>} />
      </>
    );
  }

  const [{ data: me }, { data: assignments }, { data: completions }, { data: notes }, { data: tests }, { data: rels }] = await Promise.all([
    supabase.from("athletes").select("short_term_goals, long_term_goals, date_of_birth, guardian_consent_at").eq("id", athleteId).single(),
    supabase.from("program_assignments").select("program_id, start_date, training_programs(title)").eq("athlete_id", athleteId).eq("status", "active"),
    supabase.from("workout_completions").select("session_id, status").eq("athlete_id", athleteId),
    supabase.from("athlete_notes").select("id, body, created_at").eq("athlete_id", athleteId).eq("shared_with_athlete", true).order("created_at", { ascending: false }).limit(3),
    supabase.from("test_results").select("id, tested_on, side, trials, test_definitions(name, unit, higher_is_better)").eq("athlete_id", athleteId).order("tested_on", { ascending: false }).limit(5),
    supabase.from("coach_athlete_relationships").select("id").eq("athlete_id", athleteId).eq("status", "active"),
  ]);
  const programIds = (assignments ?? []).map((a) => a.program_id);
  const { data: sessions } = programIds.length
    ? await supabase.from("training_sessions").select("*").in("program_id", programIds).order("week_number").order("day_number").limit(200)
    : { data: [] };
  const done = new Set((completions ?? []).filter((c) => c.status !== "skipped").map((c) => c.session_id));
  const upcoming = ((sessions ?? []) as TrainingSession[]).filter((s) => !done.has(s.id)).slice(0, 5);
  // Sessions planned for today (program start date + week/day offset), not yet completed.
  const startOf = new Map((assignments ?? []).map((a) => [a.program_id as string, a.start_date as string]));
  const todaySessions = ((sessions ?? []) as TrainingSession[]).filter((s) => {
    const start = startOf.get(s.program_id);
    return start && sessionDate(start, s.week_number, s.day_number) === today && !done.has(s.id);
  });

  return (
    <>
      <PageHeader title={`${td.greeting}, ${profile.full_name.split(" ")[0] || ""}`} actions={<ButtonLink variant="secondary" href={`/athletes/${athleteId}`}>{t.athletes.myProfile}</ButtonLink>} />
      {me && missingGuardianConsent(me, today) && (
        <div role="note" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          <span>{t.minors.selfBanner}</span>
          <ButtonLink variant="secondary" href={`/athletes/${athleteId}/edit`}>{t.minors.fixLink}</ButtonLink>
        </div>
      )}
      <section aria-label={td.todayWorkout} className="mb-6 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-700">{td.todayWorkout}</h2>
        {todaySessions.length === 0 ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">{td.noWorkoutToday}</p>
            <ButtonLink variant="secondary" href="/calendar">{td.openCalendar}</ButtonLink>
          </div>
        ) : (
          <ul className="mt-2 space-y-3">
            {todaySessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-ink"><bdi>{s.title}</bdi></div>
                  {s.planned_duration_min ? <div className="num text-xs text-muted">{s.planned_duration_min} {t.common.min}</div> : null}
                </div>
                <ButtonLink href={`/training/session/${s.id}?athlete=${athleteId}`}>{td.startWorkout}</ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </section>
      {(rels ?? []).length === 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-brand-900">
          {td.notConnected}
          <ButtonLink href="/connect">{td.connectCta}</ButtonLink>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={td.todaySession} className="lg:col-span-2" action={<Link className="text-xs text-brand-700 hover:underline" href="/training">{t.nav.myTraining}</Link>}>
          {upcoming.length === 0 ? <p className="text-sm text-muted">{td.noAssigned}</p> : (
            <ul className="divide-y divide-line">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted">{((assignments ?? []).find((a) => a.program_id === s.program_id)?.training_programs as unknown as { title: string } | null)?.title} · {t.common.week} {s.week_number} · {t.common.day} {s.day_number}</div>
                  </div>
                  <ButtonLink className="px-2.5 py-1 text-xs" href={`/training/session/${s.id}?athlete=${athleteId}`}>{t.training.log}</ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={td.myGoals}>
          {!me?.short_term_goals && !me?.long_term_goals ? <p className="text-sm text-muted">{td.noGoals}</p> : (
            <div className="space-y-3 text-sm">
              {me?.short_term_goals && <div><div className="text-xs text-muted">{t.athletes.shortGoals}</div><p className="whitespace-pre-line">{me.short_term_goals}</p></div>}
              {me?.long_term_goals && <div><div className="text-xs text-muted">{t.athletes.longGoals}</div><p className="whitespace-pre-line">{me.long_term_goals}</p></div>}
            </div>
          )}
        </Card>
        <Card title={t.testing.recent} action={<Link className="text-xs text-brand-700 hover:underline" href="/testing">{t.nav.myResults}</Link>}>
          {(tests ?? []).length === 0 ? <p className="text-sm text-muted">{t.testing.empty}</p> : (
            <ul className="space-y-2 text-sm">
              {(tests ?? []).map((r) => {
                const def = r.test_definitions as unknown as { name: string; unit: string; higher_is_better: boolean };
                return (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="min-w-0"><bdi>{def.name}</bdi><span className="text-xs text-muted">{r.side !== "both" && ` · ${t.testing.sides[r.side as "left" | "right"]}`} · <span className="num whitespace-nowrap">{r.tested_on}</span></span></span>
                    <span className="num shrink-0 whitespace-nowrap font-medium">{bestTrial(r.trials as number[], def.higher_is_better)} {def.unit}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title={td.coachFeedback}>
          {(notes ?? []).length === 0 ? <p className="text-sm text-muted">{td.noFeedback}</p> : (
            <ul className="space-y-3 text-sm">
              {(notes ?? []).map((n) => (
                <li key={n.id}>
                  <p className="whitespace-pre-line">{n.body}</p>
                  <div className="num text-xs text-muted">{new Date(n.created_at).toLocaleDateString(profile.locale)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
