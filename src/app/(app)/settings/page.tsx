import Link from "next/link";
import { cookies } from "next/headers";
import { ThemeSwitch } from "@/components/shell/ThemeSwitch";
import { ButtonLink, Card, Checkbox, Field, FlashMessage, Input, PageHeader, Select } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import { NOTIFICATION_CATEGORIES, mutedCategories } from "@/lib/notification-categories";
import { canAccess, type Section } from "@/lib/permissions";
import { MOTION_COOKIE, START_PAGES, TEXT_COOKIE, TEXT_SIZES, TIME_FORMATS, WEEK_STARTS, parseMotion, parsePreferences, parseTextSize } from "@/lib/preferences";
import { IDLE_COOKIE, parseIdleMinutes } from "@/lib/security/idle";
import { THEME_COOKIE, parseTheme } from "@/lib/theme/theme";
import { DeleteAccountCard } from "./security/DeleteAccountCard";
import { IdleTimeoutCard } from "./security/IdleTimeoutCard";
import { TwoFactorCard } from "./security/TwoFactorCard";
import { changeEmail, deactivateAccount, signOutEverywhere, updateDisplay, updateNotifications, updatePreferences, updateProfile } from "./actions";

export const metadata = { title: "Settings" };

const EXPORTS: { dataset: string; section: Section }[] = [
  { dataset: "athletes", section: "athletes" },
  { dataset: "tests", section: "testing" },
  { dataset: "injuries", section: "injuries" },
  { dataset: "gps", section: "gps" },
  { dataset: "readiness", section: "readiness" },
  { dataset: "wearables", section: "wearables" },
];
const JUMPS = ["profile", "preferences", "appearance", "notifications", "security", "data", "account"] as const;

/** Anchor target with room under the sticky bars. */
const Section_ = ({ id, children }: { id: string; children: React.ReactNode }) => <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 space-y-4">{children}</section>;
const Heading = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={`${id}-h`} className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { profile, org, t } = await requireProfile();
  const ts = t.settings;
  const jar = await cookies();
  const prefs = parsePreferences(profile.preferences);
  const orgRole = org?.org_role ?? null;
  const startOptions = START_PAGES.filter((s) => canAccess(s, profile.role, orgRole));
  const navLabel = (s: Section) => (s === "training" && profile.role === "athlete" ? t.nav.myTraining : t.nav[s]);

  return (
    <>
      <PageHeader title={ts.title} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <nav aria-label={ts.title} className="mb-8 flex flex-wrap gap-2">
        {JUMPS.map((j) => <a key={j} href={`#${j}`} className="press rounded-full bg-surface/90 px-3.5 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line/60 hover:text-brand-700">{ts.jump[j]}</a>)}
      </nav>

      <div className="grid max-w-4xl gap-10">
        <Section_ id="profile">
          <Heading id="profile">{ts.jump.profile}</Heading>
          <Card>
            <form action={updateProfile} className="grid gap-4 sm:grid-cols-2">
              <Field label={t.auth.fullName}><Input name="full_name" defaultValue={profile.full_name} required maxLength={120} autoComplete="name" /></Field>
              <Field label={t.common.email}><Input value={profile.email} disabled readOnly /></Field>
              <Field label={ts.phone}><Input name="phone" type="tel" inputMode="tel" defaultValue={prefs.phone} maxLength={30} autoComplete="tel" /></Field>
              <Field label={ts.jobTitle}><Input name="job_title" defaultValue={prefs.job_title} maxLength={80} autoComplete="organization-title" /></Field>
              <p className="text-xs text-muted sm:col-span-2">{ts.contactHelp}</p>
              <div className="sm:col-span-2"><SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton></div>
            </form>
          </Card>
        </Section_>

        <Section_ id="preferences">
          <Heading id="preferences">{ts.jump.preferences}</Heading>
          <Card>
            <p className="mb-4 text-sm text-ink-soft">{ts.preferencesHelp}</p>
            <form action={updatePreferences} className="grid gap-4 sm:grid-cols-2">
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
              <Field label={ts.weekStart}>
                <Select name="week_start" defaultValue={prefs.week_start}>
                  {WEEK_STARTS.map((w) => <option key={w} value={w}>{ts.weekStarts[w]}</option>)}
                </Select>
              </Field>
              <Field label={ts.timeFormat}>
                <Select name="time_format" defaultValue={prefs.time_format}>
                  {TIME_FORMATS.map((f) => <option key={f} value={f}>{ts.timeFormats[f]}</option>)}
                </Select>
              </Field>
              <Field label={ts.startPage} hint={ts.startPageHelp} className="sm:col-span-2">
                <Select name="start_page" defaultValue={startOptions.includes(prefs.start_page) ? prefs.start_page : "dashboard"}>
                  {startOptions.map((s) => <option key={s} value={s}>{navLabel(s)}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2"><SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton></div>
            </form>
          </Card>
        </Section_>

        <Section_ id="appearance">
          <Heading id="appearance">{ts.jump.appearance}</Heading>
          <Card title={ts.theme}>
            <p className="mb-3 text-sm text-ink-soft">{ts.themeHelp}</p>
            <ThemeSwitch current={parseTheme(jar.get(THEME_COOKIE)?.value)} labels={{ system: ts.themeNames.system, light: ts.themeNames.light, dark: ts.themeNames.dark }} next="/settings#appearance" />
          </Card>
          <Card>
            <form action={updateDisplay} className="space-y-4">
              <Field label={ts.textSize}>
                <Select name="text_size" defaultValue={parseTextSize(jar.get(TEXT_COOKIE)?.value)} className="max-w-xs">
                  {TEXT_SIZES.map((s) => <option key={s} value={s}>{ts.textSizes[s]}</option>)}
                </Select>
              </Field>
              <div>
                <Checkbox name="reduce_motion" label={ts.reduceMotion} defaultChecked={parseMotion(jar.get(MOTION_COOKIE)?.value) === "reduce"} />
                <p className="mt-1 ps-14 text-xs text-muted">{ts.reduceMotionHelp}</p>
              </div>
              <p className="text-xs text-muted">{ts.displayHelp}</p>
              <SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton>
            </form>
          </Card>
        </Section_>

        <Section_ id="notifications">
          <Heading id="notifications">{ts.jump.notifications}</Heading>
          <Card>
            <form action={updateNotifications} className="space-y-3">
              <div><Checkbox name="notif_in_app" label={ts.inApp} defaultChecked={profile.notification_prefs?.in_app ?? true} /></div>
              <div><Checkbox name="notif_email" label={ts.emailNotif} defaultChecked={profile.notification_prefs?.email ?? false} /></div>
              <p className="text-xs text-muted">{ts.emailNotifHelp}</p>
              <p className="pt-2 text-sm font-semibold text-ink">{ts.notifyAbout}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {NOTIFICATION_CATEGORIES.map((c) => (
                  <Checkbox key={c} name={`notify_${c}`} label={ts.categories[c]} defaultChecked={!mutedCategories(profile.notification_prefs).includes(c)} />
                ))}
              </div>
              <SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton>
            </form>
          </Card>
        </Section_>

        <Section_ id="security">
          <Heading id="security">{ts.jump.security}</Heading>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={ts.security}>
              <div className="flex flex-wrap gap-2">
                <ButtonLink variant="secondary" href="/auth/update-password">{ts.changePassword}</ButtonLink>
                <form action={signOutEverywhere}><ConfirmSubmit variant="secondary" message={ts.signOutEverywhereConfirm}>{ts.signOutEverywhere}</ConfirmSubmit></form>
              </div>
              <p className="mt-2 text-xs text-muted">{ts.signOutEverywhereHelp}</p>
            </Card>
            <Card title={ts.changeEmail}>
              <form action={changeEmail} className="space-y-3">
                <Field label={ts.newEmail}><Input name="new_email" type="email" autoComplete="email" required maxLength={320} /></Field>
                <p className="text-xs text-muted">{ts.emailHelp}</p>
                <SubmitButton variant="secondary" pendingText={t.common.saving}>{ts.sendConfirmation}</SubmitButton>
              </form>
            </Card>
            <TwoFactorCard t={t} />
            <IdleTimeoutCard t={t} minutes={parseIdleMinutes(jar.get(IDLE_COOKIE)?.value)} />
          </div>
        </Section_>

        <Section_ id="data">
          <Heading id="data">{ts.jump.data}</Heading>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={ts.privacy}>
              <p className="text-sm text-ink-soft">
                {profile.terms_accepted_at ? `${ts.consentAccepted}: ${profile.terms_accepted_at.slice(0, 10)}${profile.terms_version ? ` (${profile.terms_version})` : ""}` : ts.consentNone}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <Link className="font-medium text-brand-700 hover:underline" href="/privacy">{ts.readPrivacy}</Link>
                <Link className="font-medium text-brand-700 hover:underline" href="/terms">{ts.readTerms}</Link>
              </div>
              {canAccess("wearables", profile.role, orgRole) && profile.role === "athlete" && (
                <div className="mt-5 border-t border-line/50 pt-4">
                  <p className="text-sm font-semibold text-ink">{ts.wearableSharing}</p>
                  <p className="mt-1 text-xs text-muted">{ts.wearableSharingHelp}</p>
                  <ButtonLink variant="secondary" href="/wearables" className="mt-3">{ts.openWearables}</ButtonLink>
                </div>
              )}
            </Card>
            <Card title={ts.exports}>
              <p className="mb-3 text-xs text-muted">{ts.exportsHelp}</p>
              <ul className="grid gap-2 sm:grid-cols-2" data-testid="export-list">
                {EXPORTS.filter((e) => canAccess(e.section, profile.role, orgRole)).map((e) => (
                  <li key={e.dataset}><ButtonLink variant="secondary" href={`/export/${e.dataset}`} prefetch={false} className="w-full">{ts.exportNames[e.dataset as keyof typeof ts.exportNames]}</ButtonLink></li>
                ))}
                <li><ButtonLink variant="secondary" href="/settings/export" prefetch={false} className="w-full">{ts.exportJson}</ButtonLink></li>
              </ul>
            </Card>
          </div>
        </Section_>

        <Section_ id="account">
          <Heading id="account">{ts.jump.account}</Heading>
          <Card title={ts.account}>
            <p className="text-sm"><span className="text-muted">{ts.role}:</span> {t.roles[profile.role]}</p>
            {org && <p className="mt-1 text-sm"><span className="text-muted">{t.team.yourTeam}:</span> <bdi>{org.org_name}</bdi> · {t.orgRoles[org.org_role]}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink variant="secondary" href="/billing">{ts.billingLink}</ButtonLink>
            </div>
            <form action={deactivateAccount} className="mt-6 border-t border-line/50 pt-4">
              <p className="mb-3 text-xs text-muted">{ts.deactivateHelp}</p>
              <ConfirmSubmit variant="danger" message={ts.deactivateConfirm}>{ts.deactivate}</ConfirmSubmit>
            </form>
          </Card>
          <DeleteAccountCard t={t} />
        </Section_>
      </div>
    </>
  );
}
