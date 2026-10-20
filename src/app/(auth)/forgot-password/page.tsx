import Link from "next/link";
import { Field, FlashMessage, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getSession } from "@/lib/auth";
import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await getSession();
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-ink">{t.auth.forgotTitle}</h1>
      <p className="mb-6 text-sm text-ink-soft">{t.auth.forgotHelp}</p>
      <FlashMessage error={sp.error} ok={sp.ok} />
      <form action={requestPasswordReset} className="space-y-4">
        <Field label={t.common.email}><Input type="email" name="email" autoComplete="email" required /></Field>
        <SubmitButton className="w-full" pendingText={t.common.loading}>{t.auth.sendReset}</SubmitButton>
      </form>
      <p className="mt-6 text-sm"><Link className="text-brand-700 hover:underline" href="/login">{t.common.back}</Link></p>
    </>
  );
}
