import { sendLoginCode } from "@/app/(auth)/actions";
import { BotGuardFields } from "@/components/security/BotGuardFields";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { Dictionary } from "@/lib/i18n";

/** "Email me a sign-in code": asks for an email address and sends a one-time code (no password). */
export function CodeSignInForm({ t, next, as }: { t: Dictionary; next: string; as?: string | null }) {
  return (
    <form action={sendLoginCode} className="space-y-3" data-testid="code-signin">
      <BotGuardFields />
      <input type="hidden" name="next" value={next} />
      {as && <input type="hidden" name="as" value={as} />}
      <Field label={t.common.email}><Input type="email" name="email" autoComplete="email" required /></Field>
      <SubmitButton className="w-full" pendingText={t.common.loading}>{t.auth.codeButton}</SubmitButton>
      <p className="text-xs text-muted">{t.auth.codeNote}</p>
    </form>
  );
}
