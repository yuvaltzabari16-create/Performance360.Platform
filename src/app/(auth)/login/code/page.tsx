import Link from "next/link";
import { redirect } from "next/navigation";
import { BotGuardFields } from "@/components/security/BotGuardFields";
import { Field, FlashMessage, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { emailCodeEnabled } from "@/lib/google";
import { isLoginRole } from "@/lib/login-roles";
import { sendLoginCode, verifyLoginCode } from "../../actions";

export const metadata = { title: "Enter your code" };

/** Second step of "sign in with an email code": the person types the 6-digit code from the email. */
export default async function LoginCodePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t, user } = await getSession();
  const next = safeNext(sp.next);
  if (user) redirect(next);
  const email = (sp.email ?? "").slice(0, 320);
  if (!emailCodeEnabled() || !email) redirect(`/login?next=${encodeURIComponent(next)}`);
  const as = isLoginRole(sp.as) ? sp.as : null;
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-ink">{t.auth.codeTitle}</h1>
      <p className="mb-6 text-sm text-ink-soft">{t.auth.codeHelp.replace("{email}", "")}<bdi className="font-medium text-ink">{email}</bdi></p>
      <FlashMessage error={sp.error} ok={sp.ok ?? t.auth.codeSent} />
      <form action={verifyLoginCode} className="space-y-4">
        <BotGuardFields />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        {as && <input type="hidden" name="as" value={as} />}
        <Field label={t.auth.codeLabel}>
          <Input name="code" inputMode="numeric" pattern="\d{6,8}" maxLength={8} autoComplete="one-time-code" autoFocus required className="num text-center text-lg tracking-widest" />
        </Field>
        <SubmitButton className="w-full" pendingText={t.common.loading}>{t.auth.codeVerify}</SubmitButton>
      </form>
      <div className="mt-6 space-y-3 text-sm text-ink-soft">
        <form action={sendLoginCode}>
          <BotGuardFields />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          {as && <input type="hidden" name="as" value={as} />}
          <button type="submit" className="font-medium text-brand-700 hover:underline">{t.auth.codeResend}</button>
        </form>
        <p><Link className="text-brand-700 hover:underline" href={`/login?${as ? `as=${as}&` : ""}next=${encodeURIComponent(next)}`}>{t.auth.codeChangeEmail}</Link></p>
      </div>
    </>
  );
}
