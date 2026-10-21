import { must, supabase } from "./supabase";
import type { Checkin, Invite, Membership, Player, PlayerNote, Profile, SessionRpe, Squad, SquadStaff, TestDef, TestResult, TrainingSession } from "./types";

/** Everything a staff screen needs about the club's structure, in parallel. */
export async function loadClub(clubId: string) {
  const [squads, players, members] = await Promise.all([
    supabase.from("squads").select("*").eq("club_id", clubId).is("archived_at", null).order("name"),
    supabase.from("players").select("*").eq("club_id", clubId).is("archived_at", null).order("full_name"),
    supabase.from("club_members").select("club_id, user_id, role, created_at").eq("club_id", clubId),
  ]);
  const sq = must(squads) as Squad[];
  const mem = must(members) as Membership[];
  const [staffRes, profRes] = await Promise.all([
    sq.length ? supabase.from("squad_staff").select("squad_id, user_id").in("squad_id", sq.map((s) => s.id)) : Promise.resolve({ data: [], error: null }),
    mem.length ? supabase.from("profiles").select("id, full_name, locale").in("id", mem.map((m) => m.user_id)) : Promise.resolve({ data: [], error: null }),
  ]);
  const profiles = new Map((must(profRes) as Profile[]).map((p) => [p.id, p]));
  return {
    squads: sq,
    players: must(players) as Player[],
    members: mem,
    squadStaff: must(staffRes) as SquadStaff[],
    profiles,
  };
}
export type ClubData = Awaited<ReturnType<typeof loadClub>>;

export async function loadCheckins(clubId: string, from: string, to: string, playerId?: string) {
  let q = supabase.from("wellness_checkins").select("*").eq("club_id", clubId).gte("entry_date", from).lte("entry_date", to);
  if (playerId) q = q.eq("player_id", playerId);
  return must(await q.order("entry_date", { ascending: false })) as Checkin[];
}

export async function loadInvites(clubId: string) {
  return must(await supabase.from("invites").select("*").eq("club_id", clubId)
    .is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false })) as Invite[];
}

export async function loadNotes(playerId: string) {
  return must(await supabase.from("player_notes").select("*").eq("player_id", playerId)
    .order("created_at", { ascending: false })) as PlayerNote[];
}

export function inviteUrl(token: string) {
  return `${window.location.origin}${window.location.pathname}#/invite/${token}`;
}

export function isLiveInvite(i: Invite) {
  return !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date();
}

export function displayName(p: Profile | undefined, fallback = "—") {
  return p?.full_name?.trim() || fallback;
}

export async function loadSessions(clubId: string, from: string, to: string) {
  return must(await supabase.from("training_sessions").select("*").eq("club_id", clubId)
    .gte("session_date", from).lte("session_date", to).order("session_date")) as TrainingSession[];
}

export async function loadRpe(clubId: string, from: string, to: string, playerId?: string) {
  let q = supabase.from("session_rpe").select("*").eq("club_id", clubId).gte("session_date", from).lte("session_date", to);
  if (playerId) q = q.eq("player_id", playerId);
  return must(await q) as SessionRpe[];
}

export async function loadTestDefs() {
  // RLS returns built-in tests plus the club's own.
  return must(await supabase.from("test_definitions").select("*").is("archived_at", null).order("sort")) as TestDef[];
}

export async function loadResults(clubId: string, playerId?: string) {
  let q = supabase.from("test_results").select("*").eq("club_id", clubId);
  if (playerId) q = q.eq("player_id", playerId);
  return must(await q.order("tested_on")) as TestResult[];
}

/** Players this user can edit: directors all, coaches those in squads they coach. */
export function editablePlayerIds(d: ClubData, role: string | null, userId: string | null) {
  if (role === "director") return new Set(d.players.map((p) => p.id));
  const mine = new Set(d.squadStaff.filter((s) => s.user_id === userId).map((s) => s.squad_id));
  return new Set(d.players.filter((p) => p.squad_id && mine.has(p.squad_id)).map((p) => p.id));
}

export function testName(t: TestDef, lang: string) {
  return lang === "he" ? t.name_he : t.name_en;
}

export function fmtValue(v: number, t: TestDef) {
  return Number(v).toFixed(t.decimals);
}
