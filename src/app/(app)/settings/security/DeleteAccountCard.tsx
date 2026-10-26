import { Card, Field, Input } from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui/client";
import type { Dictionary } from "@/lib/i18n";
import { deleteAccount } from "./actions";

/** "Delete account permanently": needs the typed email and the current password. */
export function DeleteAccountCard({ t }: { t: Dictionary }) {
  const ts = t.settings;
  return (
    <Card title={ts.deleteTitle} className="border-red-200">
      <p className="mb-4 text-sm text-ink-soft">{ts.deleteHelp}</p>
      <form action={deleteAccount} className="space-y-3">
        <Field label={ts.deleteEmail}><Input type="email" name="confirm_email" autoComplete="off" required /></Field>
        <Field label={ts.deletePassword}><Input type="password" name="password" autoComplete="current-password" required /></Field>
        <ConfirmSubmit variant="danger" message={ts.deleteConfirm}>{ts.deleteButton}</ConfirmSubmit>
      </form>
    </Card>
  );
}
