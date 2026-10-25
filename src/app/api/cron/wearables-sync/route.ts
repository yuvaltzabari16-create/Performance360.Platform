import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { syncAllWhoop } from "@/lib/wearables/server";

export const dynamic = "force-dynamic";

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Scheduled WHOOP sync (Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`).
 * Without CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY the route is off and answers 404.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const admin = adminClient();
  if (!secret || !admin) return new NextResponse("Not found", { status: 404 });
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(given, secret)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await syncAllWhoop(admin);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
