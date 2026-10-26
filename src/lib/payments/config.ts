/**
 * Payments are handled ONLY by an external hosted checkout page. This app never renders card
 * fields and never receives card data: it just links to the provider's page.
 *
 * Plans come from the PAYMENT_PLANS environment variable (JSON array), e.g.
 *   [{"id":"pro","name":"Pro","description":"For coaches","checkoutUrl":"https://pay.example.com/c/abc"}]
 * Optionally restrict destinations with PAYMENT_ALLOWED_HOSTS="pay.example.com,checkout.stripe.com".
 */

export interface PaymentPlan {
  id: string;
  name: string;
  description: string | null;
  checkoutUrl: string;
}

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Parses and validates plans; entries with a missing field, a non-https URL or a disallowed host are dropped. */
export function parsePlans(raw: string | undefined, allowedHosts: string[] = []): PaymentPlan[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const plans: PaymentPlan[] = [];
  for (const item of data.slice(0, 20)) {
    const id = text(item?.id, 40);
    const name = text(item?.name, 80);
    const url = text(item?.checkoutUrl, 2000);
    if (!id || !name || !url) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") continue;
      if (allowedHosts.length && !allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) continue;
      plans.push({ id, name, description: text(item?.description, 300), checkoutUrl: u.toString() });
    } catch {
      continue;
    }
  }
  return plans;
}

/** Plans configured for this deployment. */
export function configuredPlans(): PaymentPlan[] {
  const hosts = (process.env.PAYMENT_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return parsePlans(process.env.PAYMENT_PLANS, hosts);
}
