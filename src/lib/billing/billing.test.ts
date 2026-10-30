import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withCheckoutContext } from "../payments/config";
import { describeBilling, isLockExempt } from "./state";
import { toBillingUpdate, verifyStripeSignature } from "./stripe";

const sign = (payload: string, secret: string, t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;

describe("verifyStripeSignature", () => {
  const body = '{"id":"evt_1"}';
  const now = 1_800_000_000;
  it("accepts a correct signature", () => expect(verifyStripeSignature(body, sign(body, "whsec_a", now), "whsec_a", now)).toBe(true));
  it("accepts when one of several signatures matches", () => expect(verifyStripeSignature(body, `${sign(body, "whsec_a", now)},v1=deadbeef`, "whsec_a", now)).toBe(true));
  it("rejects a wrong secret, a changed body and a missing header", () => {
    expect(verifyStripeSignature(body, sign(body, "whsec_b", now), "whsec_a", now)).toBe(false);
    expect(verifyStripeSignature(`${body} `, sign(body, "whsec_a", now), "whsec_a", now)).toBe(false);
    expect(verifyStripeSignature(body, null, "whsec_a", now)).toBe(false);
    expect(verifyStripeSignature(body, "garbage", "whsec_a", now)).toBe(false);
  });
  it("rejects an old signature (replay)", () => expect(verifyStripeSignature(body, sign(body, "whsec_a", now - 3600), "whsec_a", now)).toBe(false));
});

describe("toBillingUpdate", () => {
  const org = "11111111-2222-4333-8444-555555555555";
  it("reads a completed subscription checkout and the team that paid", () => {
    expect(toBillingUpdate({ type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: org, customer: "cus_1", subscription: "sub_1", payment_status: "paid" } } }))
      .toEqual({ orgId: org, customerId: "cus_1", subscriptionId: "sub_1", planId: null, status: "active", periodEnd: null });
  });
  it("ignores one-time payments and a client reference that is not a team id", () => {
    expect(toBillingUpdate({ type: "checkout.session.completed", data: { object: { mode: "payment" } } })).toBeNull();
    expect(toBillingUpdate({ type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: "not-a-uuid", customer: "c", subscription: "s", payment_status: "paid" } } })?.orgId).toBeNull();
  });
  it("reads subscription changes, with the period end in either place Stripe puts it", () => {
    const base = { type: "customer.subscription.updated", data: { object: { id: "sub_1", customer: "cus_1", status: "past_due", items: { data: [{ price: { id: "price_pro" }, current_period_end: 1_800_000_000 }] } } } };
    expect(toBillingUpdate(base)).toMatchObject({ subscriptionId: "sub_1", customerId: "cus_1", planId: "price_pro", status: "past_due", periodEnd: "2027-01-15T08:00:00.000Z" });
    const old = { type: "customer.subscription.created", data: { object: { id: "sub_2", customer: "cus_2", status: "trialing", current_period_end: 1_800_000_000, items: { data: [] } } } };
    expect(toBillingUpdate(old)).toMatchObject({ status: "trialing", periodEnd: "2027-01-15T08:00:00.000Z" });
  });
  it("treats a deleted subscription and an expired incomplete one as canceled", () => {
    expect(toBillingUpdate({ type: "customer.subscription.deleted", data: { object: { id: "s", customer: "c", status: "active" } } })?.status).toBe("canceled");
    expect(toBillingUpdate({ type: "customer.subscription.updated", data: { object: { id: "s", customer: "c", status: "incomplete_expired" } } })?.status).toBe("canceled");
  });
  it("ignores other events and unknown statuses", () => {
    expect(toBillingUpdate({ type: "invoice.paid", data: { object: {} } })).toBeNull();
    expect(toBillingUpdate({ type: "customer.subscription.updated", data: { object: { id: "s", status: "weird" } } })).toBeNull();
    expect(toBillingUpdate(null)).toBeNull();
  });
});

describe("billing state", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  const b = (o: Partial<Parameters<typeof describeBilling>[0]>) => ({ trial_ends_at: "2026-11-08T00:00:00Z", status: null, current_period_end: null, has_access: true, ...o });
  it("counts the days left in the trial", () => expect(describeBilling(b({}), now)).toEqual({ kind: "trial", daysLeft: 7 }));
  it("reports an ended trial", () => expect(describeBilling(b({ trial_ends_at: "2026-10-30T00:00:00Z", has_access: false }), now)).toEqual({ kind: "expired" }));
  it("shows an active subscription with its end date", () => expect(describeBilling(b({ status: "active", current_period_end: "2026-12-01T00:00:00Z" }), now)).toEqual({ kind: "active", until: "2026-12-01" }));
  it("separates a payment in grace from one past it", () => {
    expect(describeBilling(b({ status: "past_due" }), now)).toEqual({ kind: "past_due" });
    expect(describeBilling(b({ status: "past_due", has_access: false }), now)).toEqual({ kind: "expired" });
  });
  it("keeps billing, settings and export open when access has ended", () => {
    for (const p of ["/billing", "/settings", "/settings/security", "/export"]) expect(isLockExempt(p)).toBe(true);
    for (const p of ["/athletes", "/training", "/billing-x", ""]) expect(isLockExempt(p)).toBe(false);
  });
});

describe("withCheckoutContext", () => {
  it("adds the team id and the email to the checkout link", () => {
    const u = new URL(withCheckoutContext("https://buy.stripe.com/abc", { orgId: "org-1", email: "a@b.co" }));
    expect(u.searchParams.get("client_reference_id")).toBe("org-1");
    expect(u.searchParams.get("prefilled_email")).toBe("a@b.co");
  });
  it("leaves the link alone without context", () => expect(withCheckoutContext("https://buy.stripe.com/abc", {})).toBe("https://buy.stripe.com/abc"));
});
