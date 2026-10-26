import Link from "next/link";
import { Card, EmptyState, Field, FlashMessage, Input, PageHeader, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireProfessional } from "@/lib/auth";
import { createTeam } from "./actions";

export const metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, org, t } = await requireProfessional();
  const readOnly = org?.org_role === "director"; // the director sees every squad of the club, and manages none
  let query = supabase.from("teams").select("id, name, sport, season, team_members(count)").order("name");
  if (!readOnly) query = query.eq("owner_id", user.id);
  const { data: teams } = await query;
  return (
    <>
      <PageHeader title={t.teams.title} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {(teams ?? []).length === 0 ? (
            <EmptyState title={t.teams.empty} body={t.teams.emptyHelp} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {(teams ?? []).map((tm) => (
                <li key={tm.id}>
                  <Link href={`/teams/${tm.id}`} className="block rounded-xl border border-line bg-surface p-4 hover:border-brand-300">
                    <div className="font-medium text-ink">{tm.name}</div>
                    <div className="mt-1 text-sm text-ink-soft">{[tm.sport, tm.season].filter(Boolean).join(" · ") || "—"}</div>
                    <div className="num mt-2 text-xs text-muted">{(tm.team_members as unknown as { count: number }[])[0]?.count ?? 0} {t.teams.members.toLowerCase()}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!readOnly && <Card title={t.teams.new}>
          <form action={createTeam} className="space-y-3">
            <Field label={t.teams.name}><Input name="name" required maxLength={120} /></Field>
            <Field label={t.athletes.sport}><Input name="sport" /></Field>
            <Field label={t.teams.season}><Input name="season" placeholder="2026/27" /></Field>
            <Field label={t.teams.description}><Textarea name="description" rows={2} /></Field>
            <SubmitButton>{t.common.create}</SubmitButton>
          </form>
          <p className="mt-4 text-xs text-muted">{t.teams.accessNote}</p>
        </Card>}
      </div>
    </>
  );
}
