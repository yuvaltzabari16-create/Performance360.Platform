import { Card, Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { Dictionary } from "@/lib/i18n";
import { IDLE_OPTIONS } from "@/lib/security/idle";
import { setIdleTimeout } from "./actions";

/** Choose how long this browser may stay idle before it signs out. */
export function IdleTimeoutCard({ t, minutes }: { t: Dictionary; minutes: number }) {
  const ts = t.settings;
  return (
    <Card title={ts.idleTitle}>
      <p className="mb-3 text-sm text-ink-soft">{ts.idleHelp}</p>
      <form action={setIdleTimeout} className="flex flex-wrap items-end gap-2">
        <Field label={ts.idleTitle} className="min-w-44 flex-1">
          <Select name="minutes" defaultValue={String(minutes)}>
            {IDLE_OPTIONS.map((m) => <option key={m} value={m}>{m === 0 ? ts.idleOff : ts.idleMinutes.replace("{n}", String(m))}</option>)}
          </Select>
        </Field>
        <SubmitButton variant="secondary" pendingText={t.common.saving}>{t.common.save}</SubmitButton>
      </form>
    </Card>
  );
}
