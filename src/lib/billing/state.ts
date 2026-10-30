import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Teams must have an active subscription or a running trial only when the deployment turns billing on. */
export const billingRequired = () => process.env.BILLING_REQUIRED === "1";

/** Pages a team can still open when its access has ended: paying, their own settings, and exporting their data. */
const EXEMPT = ["/billing", "/settings", "/export"];
export const isLockExempt = (pathname: string) => EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export interface OrgBilling {
  org_id: string;
  org_name: string;
  trial_ends_at: string;
  status: string | null;
  plan_id: string | null;
  current_period_end: string | null;
  has_access: boolean;
  is_director: boolean;
}

export const getOrgBilling = cache(async (supabase: SupabaseClient): Promise<OrgBilling | null> => {
  const { data } = await supabase.rpc("org_billing");
  return ((data as OrgBilling[] | null) ?? [])[0] ?? null;
});

export type BillingView =
  | { kind: "trial"; daysLeft: number }
  | { kind: "active"; until: string | null }
  | { kind: "past_due" }
  | { kind: "expired" }
  | { kind: "canceled" };

/** What the billing page tells the team, from the database's own answer. */
export function describeBilling(b: Pick<OrgBilling, "trial_ends_at" | "status" | "current_period_end" | "has_access">, now = Date.now()): BillingView {
  if (b.status === "active" || b.status === "trialing") return { kind: "active", until: b.current_period_end?.slice(0, 10) ?? null };
  if (b.status === "past_due") return b.has_access ? { kind: "past_due" } : { kind: "expired" };
  if (b.status) return { kind: "canceled" };
  const daysLeft = Math.ceil((Date.parse(b.trial_ends_at) - now) / 86_400_000);
  return b.has_access && daysLeft > 0 ? { kind: "trial", daysLeft } : { kind: "expired" };
}
