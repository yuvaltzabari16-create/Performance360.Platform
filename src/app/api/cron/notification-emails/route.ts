import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { composeMail, type MailItem } from "@/lib/email/compose";
import { mailConfigured, sendMail } from "@/lib/email/send";
import { siteUrl } from "@/lib/site";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Scheduled email copies of notifications (Vercel Cron, `Authorization: Bearer $CRON_SECRET`).
 * Off (404) without CRON_SECRET, the service-role key and a mail provider.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const admin = adminClient();
  if (!secret || !admin || !mailConfigured()) return new NextResponse("Not found", { status: 404 });
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(given, secret)) return new NextResponse("Unauthorized", { status: 401 });

  const { data } = await admin.rpc("notification_email_due", { p_limit: 100 });
  const due = (data ?? []) as (MailItem & { id: string })[];
  const site = await siteUrl();
  const sent: string[] = [];
  let failed = 0;
  for (const item of due) {
    if (await sendMail(composeMail(item, site))) sent.push(item.id); else failed++;
  }
  if (sent.length) await admin.rpc("notification_mark_emailed", { p_ids: sent });
  return NextResponse.json({ due: due.length, sent: sent.length, failed }, { headers: { "Cache-Control": "no-store" } });
}
