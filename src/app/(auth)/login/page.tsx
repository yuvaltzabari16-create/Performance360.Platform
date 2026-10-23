import Link from "next/link";
import { BotGuardFields } from "@/components/security/BotGuardFields";
import { redirect } from "next/navigation";
import { Field, FlashMessage, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { login } from "../actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t, user } = await getSession();
  const next = safeNext(sp.next);
  if (user) redirect(next);
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">{t.auth.loginTitle}</h1>
      <FlashMessage error={sp.error} ok={sp.ok} />
      <form action={login} className="space-y-4">
        <BotGuardFields />
        <input type="hidden" name="next" value={next} />
        <Field label={t.common.email}><Input type="email" name="email" autoComplete="email" required /></Field>
        <Field label={t.auth.password}><Input type="password" name="password" autoComplete="current-password" required /></Field>
        <SubmitButton className="w-full" pendingText={t.common.loading}>{t.auth.login}</SubmitButton>
      </form>
      <div className="mt-6 space-y-2 text-sm text-ink-soft">
        <p><Link className="text-brand-700 hover:underline" href="/forgot-password">{t.auth.forgot}</Link></p>
        <p>{t.auth.noAccount} <Link className="font-medium text-brand-700 hover:underline" href={`/signup?next=${encodeURIComponent(next === "/dashboard" ? "/onboarding" : next)}`}>{t.auth.signup}</Link></p>
      </div>
    </>
  );
}
