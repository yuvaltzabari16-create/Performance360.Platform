import { Badge, Card } from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui/client";
import type { Dictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { disableTotp } from "./actions";
import { EnrollTotp } from "./EnrollTotp";

/** Two-factor (authenticator app) status with setup and turn-off. */
export async function TwoFactorCard({ t }: { t: Dictionary }) {
  const ts = t.settings;
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const active = data?.totp?.[0] ?? null; // verified factors only
  return (
    <Card title={ts.twoFactor} action={<Badge tone={active ? "green" : "gray"}>{active ? ts.twoFactorOn : ts.twoFactorOff}</Badge>}>
      <p className="mb-4 text-sm text-ink-soft">{ts.twoFactorHelp}</p>
      {active ? (
        <form action={disableTotp}>
          <input type="hidden" name="factor_id" value={active.id} />
          <ConfirmSubmit variant="danger" message={ts.twoFactorDisableConfirm}>{ts.twoFactorDisable}</ConfirmSubmit>
        </form>
      ) : (
        <EnrollTotp labels={{ setup: ts.twoFactorSetup, scan: ts.twoFactorScan, key: ts.twoFactorKey, code: ts.twoFactorCode, confirm: ts.twoFactorConfirm }} />
      )}
    </Card>
  );
}
