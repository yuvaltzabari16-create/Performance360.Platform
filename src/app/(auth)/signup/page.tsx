import Link from "next/link";
import { redirect } from "next/navigation";
import { Field, FlashMessage, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { signup } from "../actions";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t, user } = await getSession();
  const next = safeNext(sp.next, "/onboarding");
  if (user) redirect(next);
  const inviteCode = next.match(/code=(P360-[A-Z0-9]{6})/i)?.[1];
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">{t.auth.signupTitle}</h1>
      {inviteCode && (
        <p className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {t.auth.joinWithCode} <span className="num font-semibold">{inviteCode.toUpperCase()}</span>
        </p>
      )}
      <FlashMessage error={sp.error} />
      <form action={signup} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label={t.auth.fullName}><Input name="full_name" autoComplete="name" required maxLength={120} /></Field>
        <Field label={t.common.email}><Input type="email" name="email" autoComplete="email" required /></Field>
        <Field label={t.auth.password} hint={t.auth.passwordRule}><Input type="password" name="password" autoComplete="new-password" minLength={8} required /></Field>
        <SubmitButton className="w-full" pendingText={t.common.loading}>{t.auth.signup}</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        {t.auth.haveAccount} <Link className="font-medium text-brand-700 hover:underline" href={`/login?next=${encodeURIComponent(next)}`}>{t.auth.login}</Link>
      </p>
    </>
  );
}
