import { redirect } from "next/navigation";
import { Field, FlashMessage, Input, Logo } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { ONBOARDING_ROLES } from "@/lib/types";
import { completeOnboarding } from "./actions";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { user, profile, t, locale } = await getSession();
  if (!user) redirect("/login?next=/onboarding");
  const next = safeNext(sp.next);
  if (profile?.role) redirect(next === "/onboarding" ? "/dashboard" : next);
  const invitedAsAthlete = next.startsWith("/connect");
  return (
    <div className="min-h-dvh bg-white">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Logo className="text-lg text-ink" />
        <LanguageSwitch locale={locale} next={`/onboarding?next=${encodeURIComponent(next)}`} className="text-ink-soft" />
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.onboarding.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t.onboarding.subtitle}</p>
        <div className="mt-6"><FlashMessage error={sp.error} /></div>
        <form action={completeOnboarding} className="mt-2 space-y-6">
          <input type="hidden" name="next" value={next} />
          <Field label={t.auth.fullName}>
            <Input name="full_name" defaultValue={profile?.full_name ?? ""} required maxLength={120} />
          </Field>
          <fieldset>
            <legend className="mb-3 text-sm font-medium text-ink">{t.onboarding.roleQuestion}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ONBOARDING_ROLES.map((role) => (
                <label key={role} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                  <input type="radio" name="role" value={role} required defaultChecked={invitedAsAthlete && role === "athlete"} className="accent-brand-600" />
                  <span className="font-medium text-ink">{t.roles[role]}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">{t.onboarding.roleLocked}</p>
          </fieldset>
          <SubmitButton pendingText={t.common.saving}>{t.onboarding.continue}</SubmitButton>
        </form>
      </main>
    </div>
  );
}
