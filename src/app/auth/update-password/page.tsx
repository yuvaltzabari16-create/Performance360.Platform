import { redirect } from "next/navigation";
import { Card, Field, FlashMessage, Input, Logo } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getSession } from "@/lib/auth";
import { updatePassword } from "@/app/(auth)/actions";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t, user } = await getSession();
  if (!user) redirect("/login?next=/auth/update-password");
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-sm px-4 py-16">
      <Logo className="mb-8 text-lg text-ink" />
      <Card title={t.auth.updatePassword}>
        <FlashMessage error={sp.error} />
        <form action={updatePassword} className="space-y-4">
          <Field label={t.auth.newPassword} hint={t.auth.passwordRule}><Input type="password" name="password" autoComplete="new-password" minLength={8} required /></Field>
          <SubmitButton className="w-full" pendingText={t.common.saving}>{t.auth.updatePassword}</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
