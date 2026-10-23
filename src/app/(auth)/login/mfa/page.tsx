import { redirect } from "next/navigation";
import { Field, FlashMessage, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { signOut } from "@/app/actions";
import { verifyLoginMfa } from "../../mfa-actions";

export const metadata = { title: "Two-step verification" };

/** Shown after the password step for accounts that turned on two-factor authentication. */
export default async function MfaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t, user } = await getSession();
  if (!user) redirect("/login");
  const next = safeNext(sp.next);
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-ink">{t.auth.mfaTitle}</h1>
      <p className="mb-6 text-sm text-ink-soft">{t.auth.mfaHelp}</p>
      <FlashMessage error={sp.error} />
      <form action={verifyLoginMfa} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label={t.auth.mfaCode}>
          <Input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" autoFocus required className="num text-center text-lg tracking-widest" />
        </Field>
        <SubmitButton className="w-full" pendingText={t.common.loading}>{t.auth.mfaVerify}</SubmitButton>
      </form>
      <form action={signOut} className="mt-4 text-sm"><button className="text-brand-700 hover:underline" type="submit">{t.auth.mfaCancel}</button></form>
    </>
  );
}
