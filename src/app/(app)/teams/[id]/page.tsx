import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Card, Field, FlashMessage, Input, PageHeader, Select, Table, Td, Textarea } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { requireProfessional } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { addMembers, deleteTeam, removeMember, updateTeam } from "../actions";

export default async function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, t } = await requireProfessional();
  if (!isUuid(id)) notFound();
  const { data: team } = await supabase.from("teams").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!team) notFound();
  const [{ data: members }, { data: athletes }] = await Promise.all([
    supabase.from("team_members").select("athlete_id, added_at, athletes(id, full_name, position, status)").eq("team_id", id),
    supabase.from("athletes").select("id, full_name").eq("status", "active").order("full_name").limit(500),
  ]);
  const memberIds = new Set((members ?? []).map((m) => m.athlete_id));
  const candidates = (athletes ?? []).filter((a) => !memberIds.has(a.id));

  return (
    <>
      <PageHeader
        title={team.name}
        subtitle={[team.sport, team.season].filter(Boolean).join(" · ") || undefined}
        crumbs={[{ href: "/teams", label: t.teams.title }]}
        actions={<ButtonLink variant="secondary" href="/training">{t.training.assignTeam}</ButtonLink>}
      />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={[t.common.name, t.athletes.position, ""]}>
            {(members ?? []).length === 0 && <tr><Td className="text-muted">—</Td><Td>{""}</Td><Td>{""}</Td></tr>}
            {(members ?? []).map((m) => {
              const a = m.athletes as unknown as { id: string; full_name: string; position: string | null } | null;
              return (
                <tr key={m.athlete_id}>
                  <Td>{a ? <Link className="font-medium hover:text-brand-700" href={`/athletes/${a.id}`}>{a.full_name}</Link> : "—"}</Td>
                  <Td>{a?.position ?? "—"}</Td>
                  <Td className="text-end">
                    <form action={removeMember}>
                      <input type="hidden" name="team_id" value={id} />
                      <input type="hidden" name="athlete_id" value={m.athlete_id} />
                      <button className="text-xs text-red-700 hover:underline">{t.common.remove}</button>
                    </form>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </div>
        <div className="space-y-6">
          <Card title={t.teams.addMember}>
            <form action={addMembers} className="space-y-3">
              <input type="hidden" name="team_id" value={id} />
              <Select name="athlete_ids" multiple size={Math.min(10, Math.max(4, candidates.length))} aria-label={t.teams.addMember}>
                {candidates.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </Select>
              <SubmitButton variant="secondary">{t.common.add}</SubmitButton>
            </form>
            <p className="mt-3 text-xs text-muted">{t.teams.accessNote}</p>
          </Card>
          <Card title={t.common.edit}>
            <form action={updateTeam} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <Field label={t.teams.name}><Input name="name" defaultValue={team.name} required /></Field>
              <Field label={t.athletes.sport}><Input name="sport" defaultValue={team.sport ?? ""} /></Field>
              <Field label={t.teams.season}><Input name="season" defaultValue={team.season ?? ""} /></Field>
              <Field label={t.teams.description}><Textarea name="description" rows={2} defaultValue={team.description ?? ""} /></Field>
              <SubmitButton variant="secondary">{t.common.save}</SubmitButton>
            </form>
            <form action={deleteTeam} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="id" value={id} />
              <ConfirmSubmit variant="danger" message={`${t.common.delete} "${team.name}"?`}>{t.common.delete}</ConfirmSubmit>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
