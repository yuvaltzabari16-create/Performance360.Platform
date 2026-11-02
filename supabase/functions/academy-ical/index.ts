// academy-ical: live calendar feed (iPhone / Google / Outlook "subscribe by URL") for one academy member.
// GET /functions/v1/academy-ical?t=<private token from acad_cal_token>. Deploy with verify_jwt = false:
// calendar apps cannot sign in; the 128-bit token in the link is the credential, and it can be replaced in the app.
// Athletes get their own sessions; staff get every session in their academy (one event per group session).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const esc = (s: unknown) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => { const out: string[] = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); };
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get("t") || "").replace(/[^A-Za-z0-9]/g, "");
  if (token.length !== 32) return new Response("Not found", { status: 404 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: tok } = await sb.from("acad_cal_tokens").select("member_id").eq("token", token).maybeSingle();
  if (!tok) return new Response("Not found", { status: 404 });
  const { data: me } = await sb.from("acad_members").select("id, academy_id, role, display_name").eq("id", tok.member_id).maybeSingle();
  if (!me) return new Response("Not found", { status: 404 });
  const { data: acad } = await sb.from("acad_academies").select("name").eq("id", me.academy_id).maybeSingle();
  const { data: settings } = await sb.from("acad_docs").select("data").eq("academy_id", me.academy_id).eq("path", "academy/settings").maybeSingle();
  const tz = String(settings?.data?.timezone || "Asia/Jerusalem").replace(/[^A-Za-z0-9_\/+-]/g, "");
  let q = sb.from("acad_docs").select("path, data").eq("academy_id", me.academy_id);
  q = me.role === "athlete" ? q.eq("path", "plan/" + me.id) : q.like("path", "plan/%");
  const { data: plans } = await q;
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const events = new Map<string, any>();
  for (const row of plans || []) {
    for (const [id, s] of Object.entries((row.data?.sessions || {}) as Record<string, any>)) {
      if (!s || typeof s !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(s.date || "") || s.date < since) continue;
      const e = events.get(id); if (e) { e.count++; continue; }
      events.set(id, { ...s, id, count: 1 });
    }
  }
  const now = stamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Performance360 Academy//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc((acad?.name || "Academy") + " · Performance360")}`, `X-WR-TIMEZONE:${tz}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const e of events.values()) {
    const d = e.date.replace(/-/g, ""); const items = Array.isArray(e.items) ? e.items : [];
    const desc = [e.notes || "", ...items.slice(0, 30).map((i: any) => `• ${i.ex}${i.sets ? ` ${i.sets}×${i.reps || ""}` : i.reps ? ` ${i.reps}` : ""}${i.load ? ` @ ${i.load}` : ""}`)].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:${e.id}@performance360.academy`, `DTSTAMP:${now}`);
    if (/^\d{2}:\d{2}$/.test(e.time || "")) {
      const [h, m] = e.time.split(":").map(Number); const mins = Math.min(600, Math.max(5, Number(e.minutes) || 60));
      const end = new Date(Date.UTC(2000, 0, 1, h, m + mins)); const dayShift = end.getUTCDate() - 1;
      const endDate = new Date(Date.UTC(+e.date.slice(0, 4), +e.date.slice(5, 7) - 1, +e.date.slice(8, 10) + dayShift)).toISOString().slice(0, 10).replace(/-/g, "");
      lines.push(`DTSTART;TZID=${tz}:${d}T${e.time.replace(":", "")}00`, `DTEND;TZID=${tz}:${endDate}T${String(end.getUTCHours()).padStart(2, "0")}${String(end.getUTCMinutes()).padStart(2, "0")}00`);
    } else {
      const next = new Date(Date.UTC(+e.date.slice(0, 4), +e.date.slice(5, 7) - 1, +e.date.slice(8, 10) + 1)).toISOString().slice(0, 10).replace(/-/g, "");
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`);
    }
    lines.push(`SUMMARY:${esc((e.title || e.type || "Training") + (me.role !== "athlete" && e.count > 1 ? ` (${e.count})` : ""))}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.map(fold).join("\r\n") + "\r\n", { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "max-age=900", "Content-Disposition": 'inline; filename="academy.ics"' } });
});
