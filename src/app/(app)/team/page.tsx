import Link from "next/link";
import { Avatar, Badge, Button, Card, EmptyState, Field, FlashMessage, Input, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { ConfirmSubmit, CopyButton, ShareButton, SubmitButton } from "@/components/ui/client";
import { isTeamDirector, requireProfile } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
import { ORG_ROLES, type OrgRole } from "@/lib/types";
import { SquadsCard } from "@/components/team/SquadsCard";
import { changeMemberRole, createInvite, leaveTeam, regenerateAthleteCode, removeFromRoster, removeMember, revokeCode, setAthleteSquad } from "./actions";

export const metadata = { title: "My Team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, profile, org, t } = await requireProfile();
  const tt = t.team;

  if (profile.role === "athlete") {
    return (
      <>
        <PageHeader title={tt.title} />
        <EmptyState title={tt.title} body={t.connect.subtitle} />
      </>
    );
  }
  if (!org) {
    return (
      <>
        <PageHeader title={tt.title} />
        <Card className="max-w-lg" title={t.onboarding.joinTeam}>
          <p className="mb-4 text-sm text-ink-soft">{t.onboarding.joinTeamHelp}</p>
          <form action="/team/join" className="space-y-3">
            <Field label={t.onboarding.staffCode}>
              <Input name="code" placeholder="STAFF-XXXXXX" autoCapitalize="characters" autoComplete="off" required pattern="[Ss][Tt][Aa][Ff][Ff]-[A-Za-z0-9]{6}" className="num uppercase tracking-widest" />
            </Field>
            <Button type="submit">{t.onboarding.checkCode}</Button>
          </form>
        </Card>
      </>
    );
  }

  const director = isTeamDirector(org);
  const base = await siteUrl();
  const [{ data: summaryRows }, { data: members }, { data: roster }, { data: codes }] = await Promise.all([
    supabase.rpc("org_summary"),
    supabase.from("organization_members").select("user_id, org_role, joined_at").eq("org_id", org.org_id).eq("status", "active").order("joined_at"),
    supabase.rpc("org_roster"),
    director
      ? supabase.from("organization_codes").select("id, kind, code, org_role, expires_at").eq("org_id", org.org_id).eq("status", "active").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const summary = (summaryRows as { staff_count: number; roster_count: number; roster_with_account: number; tests_30d: number; sessions_7d: number; readiness_today: number }[] | null)?.[0];
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const nameOf = (id: string) => people?.find((p) => p.id === id);
  const athleteCode = (codes ?? []).find((c) => c.kind === "athlete");
  const invites = (codes ?? []).filter((c) => c.kind === "staff" && (!c.expires_at || new Date(c.expires_at) > new Date()));
  const rosterRows = (roster ?? []) as { athlete_id: string; full_name: string; sport: string | null; position: string | null; has_account: boolean; consent_source: string; joined_at: string }[];
  const canManageSquads = org.org_role === "director" || org.org_role === "head_of_performance";
  const [{ data: squadRows }, { data: squadCoachRows }, { data: assignRows }, { data: mySquadRows }] = await Promise.all([
    supabase.from("squads").select("id, name").eq("org_id", org.org_id).eq("status", "active").order("name"),
    supabase.from("squad_coaches").select("squad_id, user_id").eq("status", "active"),
    supabase.from("organization_athletes").select("athlete_id, squad_id").eq("org_id", org.org_id).eq("status", "active"),
    supabase.rpc("my_squads"),
  ]);
  const squads = (squadRows ?? []) as { id: string; name: string }[];
  const squadOf = new Map((assignRows ?? []).map((r) => [r.athlete_id as string, r.squad_id as string | null]));
  const coachMembers = (members ?? []).filter((m) => m.org_role === "head_coach" || m.org_role === "assistant_coach")
    .map((m) => ({ id: m.user_id as string, name: nameOf(m.user_id)?.full_name || nameOf(m.user_id)?.email || "—" }));
  const mySquads = (mySquadRows ?? []) as { id: string; name: string }[];
  const isSquadCoach = org.org_role === "head_coach" || org.org_role === "assistant_coach";
  const canManageRoster = org.org_role === "head_coach" || org.org_role === "head_of_performance";

  return (
    <>
      <PageHeader
        title={org.org_name}
        subtitle={`${tt.yourRole}: ${t.orgRoles[org.org_role]}${director ? ` · ${tt.directorView}` : ""}`}
        actions={!director && (
          <form action={leaveTeam}><ConfirmSubmit variant="danger" message={tt.leaveConfirm}>{tt.leaveTeam}</ConfirmSubmit></form>
        )}
      />
      <FlashMessage error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label={tt.staffCount} value={summary?.staff_count ?? 0} />
        <Stat label={tt.rosterCount} value={summary?.roster_count ?? 0} />
        <Stat label={tt.withAccount} value={summary?.roster_with_account ?? 0} />
        <Stat label={tt.tests30d} value={summary?.tests_30d ?? 0} />
        <Stat label={tt.sessions7d} value={summary?.sessions_7d ?? 0} />
        <Stat label={tt.readinessToday} value={summary?.readiness_today ?? 0} />
      </div>
      <p className="mt-2 text-xs text-muted">{tt.aggregateNote}</p>

      {isSquadCoach && squads.length > 0 && (
        <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm" data-testid="my-squads">
          {mySquads.length ? <><b>{tt.squads.yours}:</b> <bdi>{mySquads.map((q) => q.name).join(", ")}</bdi></> : tt.squads.noneAssigned}
        </p>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink">{tt.staff}</h2>
      <Table head={[t.common.name, tt.yourRole, tt.memberSince, ""]}>
        {(members ?? []).map((m) => {
          const person = nameOf(m.user_id);
          const self = m.user_id === user.id;
          return (
            <tr key={m.user_id}>
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={person?.full_name || person?.email || "?"} />
                  <div className="min-w-0">
                    <span className="font-semibold"><bdi>{person?.full_name || person?.email || "—"}</bdi></span>
                    {self && <span className="ms-2 text-xs text-muted">({t.team.yourRole})</span>}
                    <div className="text-xs text-muted"><bdi>{person?.email}</bdi></div>
                  </div>
                </div>
              </Td>
              <Td>
                {director ? (
                  <form action={changeMemberRole} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <Select name="org_role" defaultValue={m.org_role} aria-label={tt.changeRole} className="max-w-48 py-1.5">
                      {ORG_ROLES.map((r) => <option key={r} value={r}>{t.orgRoles[r]}</option>)}
                    </Select>
                    <SubmitButton variant="secondary" className="px-2.5 py-1.5 text-xs">{t.common.save}</SubmitButton>
                  </form>
                ) : (
                  <Badge tone={m.org_role === "director" ? "green" : "blue"}>{t.orgRoles[m.org_role as OrgRole]}</Badge>
                )}
              </Td>
              <Td><span className="num">{m.joined_at.slice(0, 10)}</span></Td>
              <Td className="text-end">
                {director && !self && (
                  <form action={removeMember}>
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <ConfirmSubmit variant="ghost" className="px-2 py-1 text-xs text-red-700" message={tt.removeConfirm}>{tt.removeMember}</ConfirmSubmit>
                  </form>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink">{tt.roster}</h2>
      {rosterRows.length === 0 ? (
        <EmptyState title={tt.roster} body={tt.rosterEmpty} />
      ) : (
        <Table head={[t.common.name, t.athletes.sport, t.athletes.position, tt.squads.column, tt.onRoster, ""]}>
          {rosterRows.map((r) => (
            <tr key={r.athlete_id}>
              <Td>
                {director
                  ? <span className="font-medium"><bdi>{r.full_name}</bdi></span>
                  : <Link href={`/athletes/${r.athlete_id}`} className="font-medium hover:text-brand-700"><bdi>{r.full_name}</bdi></Link>}
                <div className="text-xs text-muted">{r.has_account ? t.athletes.linked : t.athletes.notLinked}</div>
              </Td>
              <Td>{r.sport ?? "—"}</Td>
              <Td>{r.position ?? "—"}</Td>
              <Td>
                {canManageSquads ? (
                  <form action={setAthleteSquad} className="flex items-center gap-1">
                    <input type="hidden" name="athlete_id" value={r.athlete_id} />
                    <Select name="squad_id" defaultValue={squadOf.get(r.athlete_id) ?? ""} aria-label={`${tt.squads.column}: ${r.full_name}`} className="max-w-36 py-1.5">
                      <option value="">{tt.squads.unassigned}</option>
                      {squads.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                    </Select>
                    <SubmitButton variant="secondary" className="px-2.5 py-1.5 text-xs">{t.common.save}</SubmitButton>
                  </form>
                ) : <bdi>{squads.find((q) => q.id === squadOf.get(r.athlete_id))?.name ?? tt.squads.unassigned}</bdi>}
              </Td>
              <Td>
                <span className="text-xs text-ink-soft">{r.consent_source === "athlete" ? tt.consentAthlete : tt.consentStaff}</span>
                <div className="num text-xs text-muted">{r.joined_at.slice(0, 10)}</div>
              </Td>
              <Td className="text-end">
                {canManageRoster && (
                  <form action={removeFromRoster}>
                    <input type="hidden" name="athlete_id" value={r.athlete_id} />
                    <input type="hidden" name="back" value="/team" />
                    <ConfirmSubmit variant="ghost" className="px-2 py-1 text-xs text-red-700" message={tt.removeFromRosterConfirm}>{tt.removeFromRoster}</ConfirmSubmit>
                  </form>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-2 text-xs text-muted">{tt.rosterNote}</p>

      {(canManageSquads || squads.length > 0) && (
        <SquadsCard t={t} squads={squads} coaches={coachMembers} assigned={(squadCoachRows ?? []) as { squad_id: string; user_id: string }[]} counts={squads.map((q) => [q.id, [...squadOf.values()].filter((v) => v === q.id).length] as const)} canManage={canManageSquads} />
      )}

      {director && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card title={tt.inviteStaff}>
            <form action={createInvite} className="flex flex-wrap items-end gap-2">
              <Field label={tt.inviteRole} className="min-w-48 flex-1">
                <Select name="org_role" defaultValue="head_coach">
                  {ORG_ROLES.map((r) => <option key={r} value={r}>{t.orgRoles[r]}</option>)}
                </Select>
              </Field>
              <SubmitButton>{tt.createInvite}</SubmitButton>
            </form>
            <p className="mt-2 text-xs text-muted">{tt.inviteHelp}</p>
            <h3 className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted">{tt.activeInvites}</h3>
            {invites.length === 0 ? <p className="text-sm text-muted">{tt.noInvites}</p> : (
              <ul className="divide-y divide-line text-sm">
                {invites.map((c) => (
                  <li key={c.id} className="space-y-2 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="num font-semibold tracking-widest">{c.code}</span>
                        <span className="ms-2"><Badge tone="blue">{t.orgRoles[c.org_role as OrgRole]}</Badge></span>
                      </div>
                      <form action={revokeCode}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-xs text-red-700 hover:underline">{tt.revoke}</button>
                      </form>
                    </div>
                    <div className="num break-all text-xs text-muted">{base}/join/{c.code}</div>
                    <div className="flex items-center gap-2">
                      <CopyButton value={`${base}/join/${c.code}`} label={tt.copyLink} copiedLabel={t.common.copied} className="px-2.5 py-1 text-xs" />
                      <span className="text-xs text-muted">{tt.expires} <span className="num">{c.expires_at?.slice(0, 10)}</span></span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={tt.athleteCode}>
            <p className="mb-4 text-sm text-ink-soft">{tt.athleteCodeHelp}</p>
            {athleteCode ? (
              <div className="space-y-4">
                <div className="num rounded-xl border border-brand-200 bg-brand-50 px-6 py-4 text-center text-2xl font-semibold tracking-[0.2em] text-brand-800">{athleteCode.code}</div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={athleteCode.code} label={t.common.copy} copiedLabel={t.common.copied} />
                  <ShareButton title={org.org_name} text={`${org.org_name}:`} url={`${base}/join/${athleteCode.code}`} label={t.common.share} fallbackLabel={t.common.copied} />
                </div>
                <div>
                  <div className="text-xs text-muted">{tt.athleteLink}</div>
                  <div className="num mt-1 break-all text-sm">{base}/join/{athleteCode.code}</div>
                </div>
              </div>
            ) : <p className="text-sm text-muted">—</p>}
            <form action={regenerateAthleteCode} className="mt-5 border-t border-line pt-4">
              <ConfirmSubmit variant="secondary" message={tt.regenerateConfirm}>{tt.regenerate}</ConfirmSubmit>
            </form>
          </Card>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink">{tt.roleAccess}</h2>
      <Card>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {ORG_ROLES.map((r) => (
            <div key={r}>
              <dt className="text-sm font-medium text-ink">{t.orgRoles[r]}</dt>
              <dd className="mt-0.5 text-xs leading-5 text-ink-soft">{t.orgRoleHelp[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
