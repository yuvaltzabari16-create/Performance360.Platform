import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, FlashMessage, Logo } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { acceptTerms } from "./actions";

export const metadata = { title: "Terms" };

/** Shown once to an account created with Google, before anything else: it has not seen the sign-up form. */
export default async function TermsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t, user, profile } = await getSession();
  const next = safeNext(sp.next, "/onboarding");
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (profile?.terms_version) redirect(next);
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-sm px-4 py-16">
      <Logo className="mb-8 text-lg text-ink" />
      <Card title={t.auth.termsTitle}>
        <p className="mb-4 text-sm text-ink-soft">{t.auth.termsIntro}</p>
        <FlashMessage error={sp.error} />
        <form action={acceptTerms} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="flex items-start gap-2.5 text-sm text-ink-soft">
            <input type="checkbox" name="accept_terms" required className="mt-0.5 size-4 shrink-0 rounded border-line accent-brand-600" />
            <span>
              {t.auth.acceptPrefix} <Link className="font-medium text-brand-700 underline" href="/terms" target="_blank">{t.auth.acceptTerms}</Link> {t.auth.acceptAnd}<Link className="font-medium text-brand-700 underline" href="/privacy" target="_blank">{t.auth.acceptPrivacy}</Link>
            </span>
          </label>
          <SubmitButton className="w-full" pendingText={t.common.saving}>{t.auth.termsContinue}</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
