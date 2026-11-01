import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe webhooks, without the Stripe library: the signature check is a documented HMAC, and only the few fields
 * the app needs are read. Nothing here handles card data (payments happen on Stripe's hosted pages).
 */

/** Checks the `Stripe-Signature` header ("t=...,v1=...") against the raw request body. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec || signatures.length === 0) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  return signatures.some((s) => s.length === expected.length && timingSafeEqual(a, Buffer.from(s)));
}

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete", "paused"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface BillingUpdate {
  orgId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  planId: string | null;
  status: SubscriptionStatus;
  periodEnd: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown, max = 100) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null);
const iso = (sec: unknown) => (typeof sec === "number" && Number.isFinite(sec) && sec > 0 ? new Date(sec * 1000).toISOString() : null);

const mapStatus = (s: unknown): SubscriptionStatus | null => {
  if (s === "incomplete_expired") return "canceled";
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(s as string) ? (s as SubscriptionStatus) : null;
};

/** Turns a Stripe event into the update to store, or null for events the app does not use. */
export function toBillingUpdate(event: unknown): BillingUpdate | null {
  const e = rec(event);
  const obj = rec(rec(e.data).object);
  switch (e.type) {
    case "checkout.session.completed": {
      if (obj.mode !== "subscription") return null;
      const paid = obj.payment_status === "paid" || obj.payment_status === "no_payment_required";
      return {
        orgId: uuid(obj.client_reference_id), customerId: text(obj.customer), subscriptionId: text(obj.subscription),
        planId: text(rec(obj.metadata).plan), status: paid ? "active" : "incomplete", periodEnd: null,
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const status = e.type === "customer.subscription.deleted" ? "canceled" : mapStatus(obj.status);
      if (!status) return null;
      const item = rec((Array.isArray(rec(obj.items).data) ? (rec(obj.items).data as unknown[]) : [])[0]);
      return {
        orgId: uuid(rec(obj.metadata).org_id), customerId: text(obj.customer), subscriptionId: text(obj.id),
        planId: text(rec(item.price).id) ?? text(rec(obj.metadata).plan),
        status, periodEnd: iso(obj.current_period_end) ?? iso(item.current_period_end),
      };
    }
    default:
      return null;
  }
}
