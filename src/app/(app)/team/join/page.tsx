import { redirect } from "next/navigation";
import { Button, Card, Field, FlashMessage, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import type { OrgRole } from "@/lib/types";
import { joinTeamExisting } from "../actions";

export const metadata = { title: "Join a team" };

export default async function JoinTeamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile, org, t } = await requireProfile();
  if (profile.role === "athlete") redirect("/connect");
  if (org) redirect("/team");
  const code = /^STAFF-[A-Z0-9]{6}$/i.test(sp.code ?? "") ? sp.code!.toUpperCase() : "";
  const invite = code ? ((await supabase.rpc("preview_staff_code", { p_code: code })).data as { org_name: string; org_role: OrgRole }[] | null)?.[0] : undefined;

  return (
    <>
      <PageHeader title={t.onboarding.joinTeam} />
      <FlashMessage error={sp.error} />
      <Card className="max-w-lg">
        {invite ? (
          <form action={joinTeamExisting} className="space-y-4">
            <input type="hidden" name="code" value={code} />
            <div className="rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
              {t.onboarding.joinAs.replace("{org}", invite.org_name)} <span className="font-semibold">{t.orgRoles[invite.org_role]}</span>
              <p className="mt-1 text-xs text-brand-800/80">{t.orgRoleHelp[invite.org_role]}</p>
            </div>
            <SubmitButton pendingText={t.common.saving}>{t.onboarding.confirmJoin}</SubmitButton>
          </form>
        ) : (
          <form action="/team/join" className="space-y-4">
            {code && <p className="text-sm text-red-700">{t.onboarding.invalidStaffCode}</p>}
            <Field label={t.onboarding.staffCode}>
              <Input name="code" defaultValue={code} placeholder="STAFF-XXXXXX" autoCapitalize="characters" autoComplete="off" required pattern="[Ss][Tt][Aa][Ff][Ff]-[A-Za-z0-9]{6}" className="num uppercase tracking-widest" />
            </Field>
            <Button type="submit">{t.onboarding.checkCode}</Button>
          </form>
        )}
      </Card>
    </>
  );
}
