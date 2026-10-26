import { PayButton } from "@/components/payments/PayButton";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { configuredPlans } from "@/lib/payments/config";

export const metadata = { title: "Billing" };

/** Plans with a "Pay securely" link to the external payment provider. No card details are handled here. */
export default async function BillingPage() {
  const { t } = await requireProfile();
  const b = t.legal.billing;
  const plans = configuredPlans();
  return (
    <>
      <PageHeader title={b.title} subtitle={b.intro} />
      <p className="mb-6 max-w-2xl rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">{b.secure}</p>
      {plans.length === 0 ? (
        <EmptyState title={b.title} body={b.none} />
      ) : (
        <ul className="grid max-w-3xl gap-4 sm:grid-cols-2">
          {plans.map((p) => (
            <li key={p.id}>
              <Card title={<bdi>{p.name}</bdi>}>
                {p.description && <p className="mb-4 text-sm text-ink-soft"><bdi>{p.description}</bdi></p>}
                <PayButton href={p.checkoutUrl} label={b.pay} hint={b.leaving} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
