import { NextResponse } from "next/server";
import { toBillingUpdate, verifyStripeSignature } from "@/lib/billing/stripe";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Stripe calls this after a checkout or a subscription change. The signature is checked against the raw body, then the
 * change is stored through a service-only database function. Without STRIPE_WEBHOOK_SECRET and the service-role key
 * the route is off and answers 404.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = adminClient();
  if (!secret || !admin) return new NextResponse("Not found", { status: 404 });
  const body = await req.text();
  if (body.length > 1_000_000 || !verifyStripeSignature(body, req.headers.get("stripe-signature"), secret)) {
    return new NextResponse("Invalid signature", { status: 400 });
  }
  let event: unknown;
  try { event = JSON.parse(body); } catch { return new NextResponse("Invalid payload", { status: 400 }); }
  const update = toBillingUpdate(event);
  if (!update) return NextResponse.json({ ignored: true });
  const { data, error } = await admin.rpc("billing_apply", {
    p_org: update.orgId, p_customer: update.customerId, p_subscription: update.subscriptionId,
    p_plan: update.planId, p_status: update.status, p_period_end: update.periodEnd,
  });
  // A failure to store is reported so Stripe retries; an event for a team we cannot match is acknowledged.
  if (error) return new NextResponse("Could not store the update", { status: 500 });
  return NextResponse.json({ result: data });
}
