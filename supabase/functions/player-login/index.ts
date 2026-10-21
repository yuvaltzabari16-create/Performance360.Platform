// Username + PIN logins for players (no email needed).
// Actions (POST JSON): create {player_id, username, pin} | reset_pin {player_id, pin} | remove {player_id}
// The caller must be allowed to edit the player (director, or coach of the player's squad) — checked with the
// caller's JWT through public.can_edit_player. Account changes then run with the service role.
import { createClient } from "npm:@supabase/supabase-js@2";

/** Players sign in with `${username}@${DOMAIN}`; the address is never mailed (reserved example domain). */
const DOMAIN = "player.performance360.example.com";
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const PIN = /^\d{6}$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function weakPin(pin: string) {
  if (/^(\d)\1{5}$/.test(pin)) return true;                       // 111111
  const d = [...pin].map(Number);
  const step = d[1] - d[0];
  return Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === step); // 123456 / 654321
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: me } = await asCaller.auth.getUser();
  if (!me?.user) return json({ error: "not_authenticated" }, 401);

  let body: { action?: string; player_id?: string; username?: string; pin?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const { action, player_id } = body;
  if (!player_id || !["create", "reset_pin", "remove"].includes(action ?? "")) return json({ error: "bad_request" }, 400);

  const { data: allowed, error: permErr } = await asCaller.rpc("can_edit_player", { p_player: player_id });
  if (permErr || !allowed) return json({ error: "forbidden" }, 403);

  const { data: player } = await admin.from("players").select("id, club_id, user_id, full_name, archived_at").eq("id", player_id).maybeSingle();
  if (!player || player.archived_at) return json({ error: "player_not_found" }, 404);
  const { data: login } = await admin.from("player_logins").select("*").eq("player_id", player_id).maybeSingle();

  if (action === "create") {
    const username = String(body.username ?? "").trim().toLowerCase();
    const pin = String(body.pin ?? "");
    if (!USERNAME.test(username)) return json({ error: "bad_username" }, 400);
    if (!PIN.test(pin) || weakPin(pin)) return json({ error: "bad_pin" }, 400);
    if (player.user_id || login) return json({ error: "already_has_account" }, 409);
    const { data: taken } = await admin.from("player_logins").select("player_id").eq("username", username).maybeSingle();
    if (taken) return json({ error: "username_taken" }, 409);

    const { data: caller } = await admin.from("profiles").select("locale").eq("id", me.user.id).maybeSingle();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: `${username}@${DOMAIN}`, password: pin, email_confirm: true,
      user_metadata: { full_name: player.full_name, locale: caller?.locale ?? "he", username, player_login: true },
    });
    if (cErr || !created.user) {
      return json({ error: /already/i.test(cErr?.message ?? "") ? "username_taken" : "create_failed", detail: cErr?.message }, 409);
    }
    const uid = created.user.id;
    // link: membership, player profile, login record — undo the account if any step fails
    const steps = [
      () => admin.from("club_members").upsert({ club_id: player.club_id, user_id: uid, role: "athlete" }, { onConflict: "club_id,user_id", ignoreDuplicates: true }),
      () => admin.from("players").update({ user_id: uid }).eq("id", player.id).is("user_id", null),
      () => admin.from("player_logins").insert({ player_id: player.id, club_id: player.club_id, user_id: uid, username, created_by: me.user.id }),
    ];
    for (const step of steps) {
      const { error } = await step();
      if (error) { await admin.auth.admin.deleteUser(uid); return json({ error: "create_failed", detail: error.message }, 500); }
    }
    return json({ username });
  }

  if (!login) return json({ error: "no_login" }, 404);

  if (action === "reset_pin") {
    const pin = String(body.pin ?? "");
    if (!PIN.test(pin) || weakPin(pin)) return json({ error: "bad_pin" }, 400);
    const { error } = await admin.auth.admin.updateUserById(login.user_id, { password: pin });
    if (error) return json({ error: "reset_failed", detail: error.message }, 500);
    await admin.from("player_logins").update({ pin_reset_at: new Date().toISOString() }).eq("player_id", player_id);
    return json({ ok: true });
  }

  // remove: deleting the account unlinks the player (user_id → null) and drops membership + login (cascades)
  const { error } = await admin.auth.admin.deleteUser(login.user_id);
  if (error) return json({ error: "remove_failed", detail: error.message }, 500);
  return json({ ok: true });
});
