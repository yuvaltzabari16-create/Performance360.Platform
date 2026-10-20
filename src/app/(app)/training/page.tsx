import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, FlashMessage, PageHeader, Table, Td } from "@/components/ui";
import { BarsChart } from "@/components/charts/BarsChart";
import { getMyAthleteId, requireProfile } from "@/lib/auth";
import { sessionLoad } from "@/lib/metrics";
import type { TrainingProgram, TrainingSession } from "@/lib/types";

export const metadata = { title: "Training" };

export default async function TrainingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const session = await requireProfile();
  return session.profile.role === "athlete" ? <AthleteTraining sp={sp} /> : <CoachPrograms sp={sp} />;
}

async function CoachPrograms({ sp }: { sp: Record<string, string | undefined> }) {
  const { supabase, user, t } = await requireProfile();
  const tt = t.training;
  const view = sp.view === "templates" ? "templates" : sp.view === "archived" ? "archived" : "programs";
  let q = supabase.from("training_programs").select("*").eq("coach_id", user.id).order("updated_at", { ascending: false }).limit(200);
  if (view === "templates") q = q.eq("is_template", true).neq("status", "archived");
  else if (view === "archived") q = q.eq("status", "archived");
  else q = q.eq("is_template", false).neq("status", "archived");
  const { data } = await q;
  const programs = (data ?? []) as TrainingProgram[];
  const ids = programs.map((p) => p.id);
  const { data: assigns } = ids.length
    ? await supabase.from("program_assignments").select("program_id").in("program_id", ids).eq("status", "active")
    : { data: [] };
  const assignedCount = new Map<string, number>();
  (assigns ?? []).forEach((a) => assignedCount.set(a.program_id, (assignedCount.get(a.program_id) ?? 0) + 1));

  const tab = (key: string, label: string) => (
    <Link href={`/training?view=${key}`} className={`rounded-lg px-3 py-1.5 text-sm ${view === key ? "bg-brand-50 font-medium text-brand-800" : "text-ink-soft hover:bg-canvas"}`}>{label}</Link>
  );

  return (
    <>
      <PageHeader title={tt.title} actions={<ButtonLink href="/training/new">{tt.newProgram}</ButtonLink>} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="mb-4 flex gap-1">{tab("programs", tt.programs)}{tab("templates", tt.templates)}{tab("archived", t.common.archived)}</div>
      {programs.length === 0 ? (
        <EmptyState title={tt.empty} body={tt.emptyHelp} action={<ButtonLink href="/training/new">{tt.newProgram}</ButtonLink>} />
      ) : (
        <Table head={[tt.programTitle, tt.type, tt.weeks, tt.assigned, t.common.status]}>
          {programs.map((p) => (
            <tr key={p.id} className="hover:bg-canvas/60">
              <Td>
                <Link href={`/training/${p.id}`} className="font-medium hover:text-brand-700">{p.title}</Link>
                {p.goal && <div className="text-xs text-muted">{p.goal}</div>}
              </Td>
              <Td>{tt.types[p.program_type as keyof typeof tt.types] ?? p.program_type}</Td>
              <Td><span className="num">{p.num_weeks}</span></Td>
              <Td><span className="num">{assignedCount.get(p.id) ?? 0}</span></Td>
              <Td>
                <div className="flex gap-1">
                  <Badge tone={p.status === "active" ? "green" : p.status === "archived" ? "gray" : "amber"}>{tt.statuses[p.status]}</Badge>
                  {p.is_template && <Badge tone="blue">{tt.templates}</Badge>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function isoWeekStart(d: string) {
  const date = new Date(d + "T00:00:00Z");
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

async function AthleteTraining({ sp }: { sp: Record<string, string | undefined> }) {
  const { supabase, t } = await requireProfile();
  const tt = t.training;
  const athleteId = await getMyAthleteId();
  if (!athleteId) {
    return (
      <>
        <PageHeader title={tt.myTitle} />
        <EmptyState title={t.dashboard.noAssigned} body={t.dashboard.notConnected} action={<ButtonLink href="/connect">{t.dashboard.connectCta}</ButtonLink>} />
      </>
    );
  }
  const [{ data: assignments }, { data: completions }] = await Promise.all([
    supabase.from("program_assignments").select("id, start_date, training_programs(id, title, num_weeks, goal)").eq("athlete_id", athleteId).eq("status", "active"),
    supabase.from("workout_completions").select("id, session_id, completed_on, status, session_rpe, duration_min, training_sessions(title)").eq("athlete_id", athleteId).order("completed_on", { ascending: false }).limit(60),
  ]);
  const programIds = (assignments ?? []).map((a) => (a.training_programs as unknown as { id: string }).id);
  const { data: sessions } = programIds.length
    ? await supabase.from("training_sessions").select("*").in("program_id", programIds).order("week_number").order("day_number")
    : { data: [] };
  const doneIds = new Set((completions ?? []).filter((c) => c.status !== "skipped").map((c) => c.session_id));

  // Weekly load from logged sessions (sRPE x minutes).
  const weekly = new Map<string, number>();
  (completions ?? []).forEach((c) => {
    const load = sessionLoad(c.session_rpe, c.duration_min);
    if (load == null) return;
    const wk = isoWeekStart(c.completed_on);
    weekly.set(wk, (weekly.get(wk) ?? 0) + load);
  });
  const weeklyData = [...weekly.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([wk, load]) => ({ label: wk.slice(5), load }));

  return (
    <>
      <PageHeader title={tt.myTitle} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      {(assignments ?? []).length === 0 ? (
        <EmptyState title={t.dashboard.noAssigned} />
      ) : (
        <div className="space-y-6">
          {(assignments ?? []).map((a) => {
            const p = a.training_programs as unknown as { id: string; title: string; num_weeks: number; goal: string | null };
            const list = ((sessions ?? []) as TrainingSession[]).filter((s) => s.program_id === p.id);
            const doneCount = list.filter((s) => doneIds.has(s.id)).length;
            return (
              <Card key={a.id} title={p.title} action={<span className="num text-xs text-muted">{tt.planVsDone}: {doneCount}/{list.length}</span>}>
                {p.goal && <p className="mb-3 text-sm text-ink-soft">{p.goal}</p>}
                {list.length === 0 ? <p className="text-sm text-muted">{tt.noSessions}</p> : (
                  <ul className="divide-y divide-line">
                    {list.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div>
                          <Link href={`/training/session/${s.id}?athlete=${athleteId}`} className="font-medium hover:text-brand-700">{s.title}</Link>
                          <div className="text-xs text-muted">{t.common.week} {s.week_number} · {t.common.day} {s.day_number}{s.planned_duration_min ? ` · ${s.planned_duration_min} ${t.common.min}` : ""}</div>
                        </div>
                        {doneIds.has(s.id) ? <Badge tone="green">{tt.completed}</Badge> : <ButtonLink variant="secondary" className="px-2.5 py-1 text-xs" href={`/training/session/${s.id}?athlete=${athleteId}`}>{tt.log}</ButtonLink>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={tt.weeklyLoad}>
          {weeklyData.length === 0 ? <p className="text-sm text-muted">{tt.noHistory}</p> : <BarsChart data={weeklyData} dataKey="load" label={tt.load_au} />}
          <p className="mt-2 text-xs text-muted">{tt.loadNote}</p>
        </Card>
        <Card title={tt.history}>
          {(completions ?? []).length === 0 ? <p className="text-sm text-muted">{tt.noHistory}</p> : (
            <ul className="divide-y divide-line text-sm">
              {(completions ?? []).slice(0, 10).map((c) => (
                <li key={c.id} className="flex justify-between py-2">
                  <span>{(c.training_sessions as unknown as { title: string } | null)?.title ?? "—"}</span>
                  <span className="num text-xs text-muted">{c.completed_on}{c.session_rpe != null && ` · RPE ${c.session_rpe}`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
