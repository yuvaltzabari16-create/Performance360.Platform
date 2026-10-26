import { Badge, Button, ButtonLink, Card, Field, FlashMessage, Input, PageHeader } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import type { OrgRole, UserRole } from "@/lib/types";
import { endRelationship } from "../athletes/actions";
import { connectWithCode, leaveTeamAsAthlete } from "./actions";

export const metadata = { title: "Connect to a coach" };

export default async function ConnectPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, profile, t } = await requireProfile();
  const tc = t.connect;
  if (profile.role !== "athlete") {
    return (
      <>
        <PageHeader title={tc.title} />
        <Card><p className="text-sm text-ink-soft">{tc.notAthlete}</p></Card>
      </>
    );
  }

  const code = (sp.code ?? "").toUpperCase().slice(0, 20);
  const isTeamCode = /^TEAM-[A-Z0-9]{6}$/.test(code);
  // Previews only reveal a public name (coach name, or team name and sport) for an active code.
  const coachPreview = /^P360-[A-Z0-9]{6}$/.test(code)
    ? ((await supabase.rpc("preview_coach_code", { p_code: code })).data as { coach_name: string; coach_role: UserRole }[] | null)?.[0]
    : undefined;
  const teamPreview = isTeamCode
    ? ((await supabase.rpc("preview_org_code", { p_code: code })).data as { org_name: string; sport: string | null }[] | null)?.[0]
    : undefined;
  const hasPreview = Boolean(coachPreview || teamPreview);

  const { data: me } = await supabase.from("athletes").select("id").eq("user_id", user.id).maybeSingle();
  const { data: rels } = me
    ? await supabase.from("coach_athlete_relationships").select("id, coach_id, kind, started_at").eq("athlete_id", me.id).eq("status", "active")
    : { data: [] };
  const ids = (rels ?? []).map((r) => r.coach_id);
  const { data: coaches } = ids.length ? await supabase.from("profiles").select("id, full_name, role").in("id", ids) : { data: [] };

  const { data: teamRows } = me
    ? await supabase.from("organization_athletes").select("org_id, consented_at, organizations(name)").eq("athlete_id", me.id).eq("status", "active")
    : { data: [] };
  const teamIds = (teamRows ?? []).map((r) => r.org_id);
  const { data: staff } = teamIds.length
    ? await supabase.from("organization_members").select("org_id, org_role").in("org_id", teamIds).eq("status", "active")
    : { data: [] };

  return (
    <>
      <PageHeader title={tc.title} subtitle={tc.subtitle} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={tc.codeLabel}>
          {hasPreview ? (
            <div className="space-y-4">
              {coachPreview && (
                <>
                  <div>
                    <div className="text-xs text-muted">{tc.confirmTitle}</div>
                    <div className="mt-1 text-lg font-semibold text-ink"><bdi>{coachPreview.coach_name || "—"}</bdi></div>
                    <div className="text-sm text-ink-soft">{t.roles[coachPreview.coach_role]}</div>
                  </div>
                  {sp.transfer ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                      <div className="font-medium">{tc.transferTitle}</div>
                      <p className="mt-1">{tc.transferBody}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-soft">{tc.confirmBody}</p>
                  )}
                </>
              )}
              {teamPreview && (
                <>
                  <div>
                    <div className="text-xs text-muted">{tc.teamConfirmTitle}</div>
                    <div className="mt-1 text-lg font-semibold text-ink"><bdi>{teamPreview.org_name}</bdi></div>
                    {teamPreview.sport && <div className="text-sm text-ink-soft"><bdi>{teamPreview.sport}</bdi></div>}
                  </div>
                  <p className="text-sm text-ink-soft">{tc.teamConfirmBody}</p>
                </>
              )}
              <form action={connectWithCode} className="flex gap-2">
                <input type="hidden" name="code" value={code} />
                {sp.transfer && <input type="hidden" name="confirm_transfer" value="1" />}
                <SubmitButton pendingText={t.common.loading}>{teamPreview ? tc.joinTeamBtn : sp.transfer ? tc.transferBtn : tc.connectBtn}</SubmitButton>
                <ButtonLink href="/connect" variant="ghost">{t.common.cancel}</ButtonLink>
              </form>
            </div>
          ) : (
            <form action="/connect" className="space-y-3">
              {code && <p className="text-sm text-red-700">{tc.invalid}</p>}
              <Field label={tc.codeLabel} hint={tc.teamHint}>
                <Input name="code" defaultValue={code} placeholder="P360-XXXXXX / TEAM-XXXXXX" autoCapitalize="characters" autoComplete="off" required pattern="([Pp]360|[Tt][Ee][Aa][Mm])-[A-Za-z0-9]{6}" className="num uppercase tracking-widest" />
              </Field>
              <Button type="submit">{tc.check}</Button>
            </form>
          )}
        </Card>

        <div className="space-y-6">
          <Card title={tc.myConnections}>
            {(rels ?? []).length === 0 ? (
              <p className="text-sm text-muted">{(teamRows ?? []).length ? "—" : t.dashboard.notConnected}</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {(rels ?? []).map((r) => {
                  const c = coaches?.find((p) => p.id === r.coach_id);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium"><bdi>{c?.full_name ?? "—"}</bdi></div>
                        <div className="text-xs text-muted">{c?.role ? t.roles[c.role as UserRole] : ""} · {r.started_at.slice(0, 10)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={r.kind === "primary" ? "green" : "blue"}>{r.kind === "primary" ? t.athletes.primary : t.athletes.collaborator}</Badge>
                        <form action={endRelationship}>
                          <input type="hidden" name="relationship_id" value={r.id} />
                          <input type="hidden" name="back" value="/connect" />
                          <ConfirmSubmit variant="ghost" className="px-2 py-1 text-xs" message={t.athletes.endConfirm}>{t.athletes.endConnection}</ConfirmSubmit>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {(teamRows ?? []).map((tr) => {
            const roles = [...new Set((staff ?? []).filter((s) => s.org_id === tr.org_id && s.org_role !== "director").map((s) => s.org_role as OrgRole))];
            return (
              <Card key={tr.org_id} title={`${tc.myTeam}: ${(tr.organizations as unknown as { name: string } | null)?.name ?? ""}`}>
                <p className="text-sm text-ink-soft">{t.team.teamAccessNote}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {roles.map((r) => <Badge key={r} tone="blue">{t.orgRoles[r]}</Badge>)}
                </div>
                <div className="mt-2 text-xs text-muted">{t.team.onRoster} · {tr.consented_at.slice(0, 10)}</div>
                <form action={leaveTeamAsAthlete} className="mt-4">
                  <input type="hidden" name="org_id" value={tr.org_id} />
                  <ConfirmSubmit variant="danger" message={tc.leaveConfirm}>{tc.leaveTeam}</ConfirmSubmit>
                </form>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
