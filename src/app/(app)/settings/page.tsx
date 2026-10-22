import { ButtonLink, Card, Checkbox, Field, FlashMessage, Input, PageHeader, Select } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import { deactivateAccount, updateSettings } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { profile, org, t } = await requireProfile();
  const ts = t.settings;
  return (
    <>
      <PageHeader title={ts.title} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card title={ts.profile} className="lg:col-span-2">
          <form action={updateSettings} className="grid gap-4 sm:grid-cols-2">
            <Field label={t.auth.fullName}><Input name="full_name" defaultValue={profile.full_name} required maxLength={120} /></Field>
            <Field label={t.common.email}><Input value={profile.email} disabled readOnly /></Field>
            <Field label={t.common.language}>
              <Select name="locale" defaultValue={profile.locale}>
                <option value="en">English</option>
                <option value="he">עברית</option>
              </Select>
            </Field>
            <Field label={ts.units}>
              <Select name="units" defaultValue={profile.units}>
                <option value="metric">{ts.metric}</option>
                <option value="imperial">{ts.imperial}</option>
              </Select>
            </Field>
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="mb-1 text-sm font-medium text-ink">{ts.notifications}</legend>
              <div><Checkbox name="notif_in_app" label={ts.inApp} defaultChecked={profile.notification_prefs?.in_app ?? true} /></div>
              <div><Checkbox name="notif_email" label={ts.emailNotif} defaultChecked={profile.notification_prefs?.email ?? false} /></div>
              <p className="text-xs text-muted">{ts.emailNotifHelp}</p>
            </fieldset>
            <div className="sm:col-span-2"><SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton></div>
          </form>
        </Card>
        <Card title={ts.security}>
          <ButtonLink variant="secondary" href="/auth/update-password">{ts.changePassword}</ButtonLink>
        </Card>
        <Card title={ts.account}>
          <p className="text-sm"><span className="text-muted">{ts.role}:</span> {t.roles[profile.role]}</p>
          {org && <p className="mt-1 text-sm"><span className="text-muted">{t.team.yourTeam}:</span> <bdi>{org.org_name}</bdi> · {t.orgRoles[org.org_role]}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink variant="secondary" href="/settings/export" prefetch={false}>{ts.exportData}</ButtonLink>
          </div>
          <form action={deactivateAccount} className="mt-6 border-t border-line pt-4">
            <p className="mb-3 text-xs text-muted">{ts.deactivateHelp}</p>
            <ConfirmSubmit variant="danger" message={ts.deactivateConfirm}>{ts.deactivate}</ConfirmSubmit>
          </form>
        </Card>
      </div>
    </>
  );
}
