import { PayButton } from "@/components/payments/PayButton";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { billingRequired, describeBilling, getOrgBilling } from "@/lib/billing/state";
import { configuredPlans, withCheckoutContext } from "@/lib/payments/config";

export const metadata = { title: "Billing" };

const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/** The portal link Stripe gives for "manage subscription" (https only). */
const portalUrl = () => {
  const raw = process.env.BILLING_PORTAL_URL;
  try { return raw && new URL(raw).protocol === "https:" ? raw : null; } catch { return null; }
};

/** Plans with a "Pay securely" link to the external payment provider. No card details are handled here. */
export default async function BillingPage() {
  const { t, supabase, org, user } = await requireProfile();
  const b = t.legal.billing;
  const plans = configuredPlans();
  const billing = org ? await getOrgBilling(supabase) : null;
  const view = billing ? describeBilling(billing) : null;
  const canPay = !org || billing?.is_director === true;
  const statusText = !view ? null
    : view.kind === "trial" ? fill(b.trial, { days: view.daysLeft })
    : view.kind === "active" ? (view.until ? fill(b.activeUntil, { date: view.until }) : b.active)
    : view.kind === "past_due" ? b.pastDue
    : view.kind === "canceled" ? b.canceled
    : b.expired;
  const portal = portalUrl();
  return (
    <>
      <PageHeader title={b.title} subtitle={b.intro} />
      {billing && billingRequired() && !billing.has_access && <p role="alert" className="mb-4 max-w-2xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{b.lockedNote}</p>}
      {statusText && (
        <div className="mb-6 max-w-3xl"><Card title={b.statusTitle}>
          <p className="text-sm text-ink-soft" data-testid="billing-status">{statusText}</p>
          {portal && canPay && billing?.status && <p className="mt-4"><PayButton href={portal} label={b.manage} hint={b.manageHint} /></p>}
        </Card></div>
      )}
      <p className="mb-6 max-w-2xl rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">{b.secure}</p>
      {!canPay ? (
        <EmptyState title={b.title} body={b.directorOnly} />
      ) : plans.length === 0 ? (
        <EmptyState title={b.title} body={b.none} />
      ) : (
        <ul className="grid max-w-3xl gap-4 sm:grid-cols-2">
          {plans.map((p) => (
            <li key={p.id}>
              <Card title={<bdi>{p.name}</bdi>}>
                {p.description && <p className="mb-4 text-sm text-ink-soft"><bdi>{p.description}</bdi></p>}
                <PayButton href={withCheckoutContext(p.checkoutUrl, { orgId: org?.org_id, email: user.email })} label={b.pay} hint={b.leaving} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
