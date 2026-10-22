import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Field, FlashMessage, Input, Logo, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { INDEPENDENT_ROLES, type OrgRole } from "@/lib/types";
import { completeOnboarding, createTeam, joinTeam } from "./actions";

export const metadata = { title: "Welcome" };

type Params = Record<string, string | undefined>;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { supabase, user, profile, t, locale } = await getSession();
  if (!user) redirect("/login?next=/onboarding");
  const next = safeNext(sp.next);
  if (profile?.role) redirect(next === "/onboarding" ? "/dashboard" : next);

  // Invitation links carry their intent, so the matching account type is pre-selected.
  const type = (["team", "independent", "athlete"] as const).find((x) => x === sp.type) ?? (next.startsWith("/connect") ? "athlete" : null);
  const here = `/onboarding?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), ...(sp.mode ? { mode: sp.mode } : {}), ...(sp.code ? { code: sp.code } : {}), next }).toString()}`;
  const to = (params: Record<string, string>) => `/onboarding?${new URLSearchParams({ ...params, ...(next !== "/dashboard" ? { next } : {}) })}`;

  const code = /^STAFF-[A-Z0-9]{6}$/i.test(sp.code ?? "") ? sp.code!.toUpperCase() : "";
  const invite = type === "team" && sp.mode === "join" && code
    ? ((await supabase.rpc("preview_staff_code", { p_code: code })).data as { org_name: string; org_role: OrgRole }[] | null)?.[0]
    : undefined;

  const to2 = t.accountTypes;
  const types = [
    { key: "team" as const, title: to2.team.title, body: to2.team.body, icon: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8" },
    { key: "independent" as const, title: to2.independent.title, body: to2.independent.body, icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
    { key: "athlete" as const, title: to2.athlete.title, body: to2.athlete.body, icon: "M2 12h4l3-8 4 16 3-8h6" },
  ];

  return (
    <div className="min-h-dvh bg-white">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Logo className="text-lg text-ink" />
        <LanguageSwitch locale={locale} next={here} className="text-ink-soft" />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.onboarding.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{type ? t.onboarding.subtitle : t.onboarding.chooseType}</p>
        <div className="mt-6"><FlashMessage error={sp.error} /></div>

        {!type && (
          <div className="grid gap-3 sm:grid-cols-3">
            {types.map((x) => (
              <Link key={x.key} href={to({ type: x.key })} className="group flex flex-col rounded-xl border border-line p-5 transition-colors hover:border-brand-400 hover:bg-brand-50/40">
                <span className="mb-4 grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={x.icon} /></svg>
                </span>
                <span className="font-semibold text-ink">{x.title}</span>
                <span className="mt-1.5 text-sm leading-6 text-ink-soft">{x.body}</span>
              </Link>
            ))}
          </div>
        )}

        {type && <p className="mb-5"><Link href={to({})} className="text-sm text-brand-700 hover:underline">← {t.onboarding.changeType}</Link></p>}

        {type === "athlete" && (
          <Card title={to2.athlete.title}>
            <form action={completeOnboarding} className="space-y-4">
              <input type="hidden" name="type" value="athlete" />
              <input type="hidden" name="next" value={next} />
              <Field label={t.onboarding.yourName}><Input name="full_name" defaultValue={profile?.full_name ?? ""} required maxLength={120} /></Field>
              <SubmitButton pendingText={t.common.saving}>{t.onboarding.continue}</SubmitButton>
            </form>
          </Card>
        )}

        {type === "independent" && (
          <Card title={to2.independent.title}>
            <form action={completeOnboarding} className="space-y-4">
              <input type="hidden" name="type" value="independent" />
              <input type="hidden" name="next" value={next} />
              <Field label={t.onboarding.yourName}><Input name="full_name" defaultValue={profile?.full_name ?? ""} required maxLength={120} /></Field>
              <Field label={t.onboarding.profession}>
                <Select name="role" defaultValue="personal_trainer">
                  {INDEPENDENT_ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}
                </Select>
              </Field>
              <p className="text-xs text-muted">{t.onboarding.roleLocked}</p>
              <SubmitButton pendingText={t.common.saving}>{t.onboarding.continue}</SubmitButton>
            </form>
          </Card>
        )}

        {type === "team" && !sp.mode && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={to({ type: "team", mode: "create" })} className="rounded-xl border border-line p-5 hover:border-brand-400 hover:bg-brand-50/40">
              <div className="font-semibold text-ink">{t.onboarding.createTeam}</div>
              <p className="mt-1.5 text-sm text-ink-soft">{t.onboarding.createTeamHelp}</p>
            </Link>
            <Link href={to({ type: "team", mode: "join" })} className="rounded-xl border border-line p-5 hover:border-brand-400 hover:bg-brand-50/40">
              <div className="font-semibold text-ink">{t.onboarding.joinTeam}</div>
              <p className="mt-1.5 text-sm text-ink-soft">{t.onboarding.joinTeamHelp}</p>
            </Link>
          </div>
        )}

        {type === "team" && sp.mode === "create" && (
          <Card title={t.onboarding.createTeam}>
            <form action={createTeam} className="space-y-4">
              <Field label={t.onboarding.teamName}><Input name="team_name" required maxLength={120} /></Field>
              <Field label={t.onboarding.teamSport}><Input name="sport" maxLength={80} /></Field>
              <Field label={t.onboarding.yourName}><Input name="full_name" defaultValue={profile?.full_name ?? ""} required maxLength={120} /></Field>
              <p className="text-xs text-muted">{t.onboarding.createTeamHelp}</p>
              <SubmitButton pendingText={t.common.saving}>{t.onboarding.createTeam}</SubmitButton>
            </form>
          </Card>
        )}

        {type === "team" && sp.mode === "join" && (
          <Card title={t.onboarding.joinTeam}>
            {invite ? (
              <form action={joinTeam} className="space-y-4">
                <input type="hidden" name="code" value={code} />
                <div className="rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
                  {t.onboarding.joinAs.replace("{org}", invite.org_name)}{" "}
                  <span className="font-semibold">{t.orgRoles[invite.org_role]}</span>
                  <p className="mt-1 text-xs text-brand-800/80">{t.orgRoleHelp[invite.org_role]}</p>
                </div>
                <Field label={t.onboarding.yourName}><Input name="full_name" defaultValue={profile?.full_name ?? ""} required maxLength={120} /></Field>
                <SubmitButton pendingText={t.common.saving}>{t.onboarding.confirmJoin}</SubmitButton>
              </form>
            ) : (
              <form action="/onboarding" className="space-y-4">
                <input type="hidden" name="type" value="team" />
                <input type="hidden" name="mode" value="join" />
                {next !== "/dashboard" && <input type="hidden" name="next" value={next} />}
                {code && <p className="text-sm text-red-700">{t.onboarding.invalidStaffCode}</p>}
                <Field label={t.onboarding.staffCode}>
                  <Input name="code" defaultValue={code || sp.code?.slice(0, 20)} placeholder="STAFF-XXXXXX" autoCapitalize="characters" autoComplete="off" required pattern="[Ss][Tt][Aa][Ff][Ff]-[A-Za-z0-9]{6}" className="num uppercase tracking-widest" />
                </Field>
                <SubmitButton pendingText={t.common.loading}>{t.onboarding.checkCode}</SubmitButton>
              </form>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
