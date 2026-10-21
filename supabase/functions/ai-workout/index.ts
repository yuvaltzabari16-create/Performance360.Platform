// AI workout assistant: builds or edits a workout using ONLY the club's exercise library.
// Runs with the caller's JWT, so every read goes through RLS. Needs the ANTHROPIC_API_KEY secret.
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5-5";
const DAILY_LIMIT_PER_CLUB = 100;
const FIELDS = ["reps", "load", "pct1rm", "rpe", "rir", "tempo", "time", "distance", "rest"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const setSchema = {
  type: "object",
  properties: Object.fromEntries(FIELDS.map((f) => [f, { type: "string" }])),
  required: FIELDS,
  additionalProperties: false,
};
const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    title: { type: "string" },
    focus: { type: "string", enum: ["strength", "power", "speed", "conditioning", "mobility", "rtp", "prehab", "mixed"] },
    est_minutes: { type: "integer" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["single", "superset", "circuit"] },
                rounds: { type: "integer" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      note: { type: "string" },
                      fields: { type: "array", items: { type: "string", enum: FIELDS } },
                      sets: { type: "array", items: setSchema },
                    },
                    required: ["code", "note", "fields", "sets"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["kind", "rounds", "items"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "blocks"],
        additionalProperties: false,
      },
    },
  },
  required: ["reply", "title", "focus", "est_minutes", "sections"],
  additionalProperties: false,
};

const SYSTEM = `You are the workout assistant inside Performance360, a performance platform for football (soccer) clubs and academies.
You write workouts for strength & conditioning coaches and physios.

Rules:
- Use ONLY exercises from the EXERCISE LIBRARY below, referenced by their code (e.g. "E12"). Never invent exercises or codes.
- Structure the workout in sections (e.g. warm-up, mobility, plyometric prep, main strength/power work, accessory, cool-down) as the coach asks.
- Inside a section, group exercises into blocks: "single" (straight sets), "superset" (2-3 exercises alternated) or "circuit" (3+ exercises, set "rounds").
  For "single" blocks set rounds to 0. For supersets/circuits, rounds = number of rounds and give each exercise exactly that many sets.
- For each exercise choose only the fields that matter (from: reps, load, pct1rm, rpe, rir, tempo, time, distance, rest) and fill one object per set.
  Put "" for fields you did not choose. Use compact coach notation: reps "5" or "3-5" or "6/side", load "20 kg", pct1rm "75%", rpe "7", time "0:30", distance "20 m", rest "1:30".
- Football context: respect match-day proximity (MD-1/MD-2 = low volume, high intent, no heavy eccentrics), youth age groups (technique first, conservative loads), injury/RTP constraints the coach mentions.
- "note" = one short coaching cue for that exercise (in the coach's language), or "" if none needed.
- "reply" = 1-3 short sentences to the coach explaining the plan or what you changed, in the coach's language.
- Title, section titles, notes and reply must be in LANGUAGE.
- When MODIFYING, return the complete updated workout, keeping everything the coach did not ask to change.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ai_not_configured" }, 503);

  const auth = req.headers.get("Authorization") ?? "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });

  let body: { club_id?: string; mode?: string; prompt?: string; lang?: string; workout?: unknown; squad_id?: string | null; history?: { role: string; text: string }[] };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const { club_id, prompt } = body;
  const mode = body.mode === "modify" ? "modify" : "create";
  const lang = body.lang === "en" ? "English" : "Hebrew";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!club_id || !UUID.test(club_id) || !prompt || typeof prompt !== "string" || prompt.length > 4000) return json({ error: "bad_request" }, 400);
  if (body.squad_id && !UUID.test(body.squad_id)) return json({ error: "bad_request" }, 400);

  const { data: staff, error: staffErr } = await db.rpc("is_staff", { p_club: club_id });
  if (staffErr || !staff) return json({ error: "forbidden" }, 403);

  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await db.from("ai_usage").select("id", { count: "exact", head: true }).eq("club_id", club_id).gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT_PER_CLUB) return json({ error: "rate_limited" }, 429);

  // Library -> short codes (keeps the prompt small and the output verifiable)
  const { data: exercises, error: exErr } = await db.from("exercises")
    .select("id, name_en, name_he, category, equipment").is("archived_at", null)
    .or(`club_id.is.null,club_id.eq.${club_id}`).order("sort");
  if (exErr || !exercises?.length) return json({ error: "library_unavailable" }, 500);
  const byCode = new Map<string, { id: string; name: string }>();
  const idToCode = new Map<string, string>();
  const catalog = exercises.map((e, i) => {
    const code = `E${i + 1}`;
    byCode.set(code, { id: e.id, name: e.name_en });
    idToCode.set(e.id, code);
    return `${code} | ${e.name_en} | ${e.category} | ${(e.equipment ?? []).join(",")}`;
  }).join("\n");

  // Optional squad context so the AI can respect readiness and availability
  let context = "";
  if (body.squad_id) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: squad } = await db.from("squads").select("name, age_group").eq("id", body.squad_id).maybeSingle();
    const { data: players } = await db.from("players").select("id, full_name, status").eq("squad_id", body.squad_id).is("archived_at", null);
    const { data: wellness } = players?.length
      ? await db.from("wellness_checkins").select("player_id, readiness, pain, pain_area").eq("entry_date", today).in("player_id", players.map((p) => p.id))
      : { data: [] };
    const avg = wellness?.length ? Math.round(wellness.reduce((s, w) => s + w.readiness, 0) / wellness.length) : null;
    const out = (players ?? []).filter((p) => p.status !== "available").map((p) => `${p.full_name} (${p.status})`);
    const pain = (wellness ?? []).filter((w) => w.pain).map((w) => players?.find((p) => p.id === w.player_id)?.full_name + (w.pain_area ? ` – ${w.pain_area}` : ""));
    context = `\n\nSQUAD CONTEXT: ${squad?.name ?? ""} ${squad?.age_group ?? ""}, ${players?.length ?? 0} players. ` +
      `Today's average readiness: ${avg ?? "no check-ins"}/100. Not available: ${out.join(", ") || "none"}. Reported pain today: ${pain.join(", ") || "none"}.`;
  }

  // In modify mode, send the current workout re-encoded with library codes
  let current = "";
  if (mode === "modify" && body.workout) {
    const w = body.workout as { title?: string; content?: { sections?: { title: string; blocks: { kind: string; rounds?: number; items: { exercise_id: string | null; name: string; note?: string; fields: string[]; sets: Record<string, string>[] }[] }[] }[] } };
    const enc = {
      title: w.title,
      sections: (w.content?.sections ?? []).map((s) => ({
        title: s.title,
        blocks: s.blocks.map((b) => ({
          kind: b.kind, rounds: b.rounds ?? 0,
          items: b.items.map((it) => ({ code: (it.exercise_id && idToCode.get(it.exercise_id)) || `CUSTOM:${it.name}`, note: it.note ?? "", fields: it.fields, sets: it.sets })),
        })),
      })),
    };
    current = `\n\nCURRENT WORKOUT (JSON):\n${JSON.stringify(enc)}`;
  }

  const history = (body.history ?? []).slice(-6).map((m) => `${m.role === "user" ? "Coach" : "Assistant"}: ${m.text}`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: [
        { type: "text", text: SYSTEM.replaceAll("LANGUAGE", lang) },
        { type: "text", text: `EXERCISE LIBRARY (code | name | category | equipment):\n${catalog}`, cache_control: { type: "ephemeral" } },
      ],
      messages: [{
        role: "user",
        content: `${history ? `Conversation so far:\n${history}\n\n` : ""}${mode === "modify" ? "Modify the current workout." : "Create a new workout."}${context}${current}\n\nCOACH REQUEST: ${prompt}`,
      }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("anthropic error", res.status, detail.slice(0, 500));
    return json({ error: res.status === 429 ? "rate_limited" : "ai_failed" }, 502);
  }
  const msg = await res.json();
  if (msg.stop_reason === "refusal") return json({ error: "refused" }, 422);
  const text = msg.content?.find((c: { type: string }) => c.type === "text")?.text;
  let out: { reply: string; title: string; focus: string; est_minutes: number; sections: { title: string; blocks: { kind: string; rounds: number; items: { code: string; note: string; fields: string[]; sets: Record<string, string>[] }[] }[] }[] };
  try { out = JSON.parse(text); } catch { return json({ error: "invalid_json" }, 502); }

  // Map codes back to library ids, drop anything not in the library, strip empty set fields
  const rid = () => crypto.randomUUID().slice(0, 8);
  let dropped = 0;
  const sections = out.sections.map((s) => ({
    id: rid(), title: s.title,
    blocks: s.blocks.map((b) => ({
      id: rid(), kind: b.kind, ...(b.kind !== "single" && b.rounds ? { rounds: b.rounds } : {}),
      items: b.items.flatMap((it) => {
        const ex = byCode.get(it.code);
        const custom = it.code.startsWith("CUSTOM:") ? it.code.slice(7) : null;
        if (!ex && !custom) { dropped++; return []; }
        const fields = it.fields.filter((f) => FIELDS.includes(f));
        return [{
          id: rid(), exercise_id: ex?.id ?? null, name: ex?.name ?? custom!, ...(it.note ? { note: it.note } : {}), fields,
          sets: it.sets.map((row) => Object.fromEntries(fields.filter((f) => row[f]).map((f) => [f, row[f]]))),
        }];
      }),
    })).filter((b) => b.items.length),
  }));

  await db.from("ai_usage").insert({
    club_id, kind: mode, model: MODEL,
    input_tokens: msg.usage?.input_tokens ?? null, output_tokens: msg.usage?.output_tokens ?? null,
  });

  return json({
    reply: out.reply,
    dropped,
    workout: { title: out.title, focus: out.focus, est_minutes: out.est_minutes, content: { sections } },
  });
});
