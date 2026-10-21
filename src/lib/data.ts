import { must, supabase } from "./supabase";
import type { Checkin, Invite, Membership, Player, PlayerNote, Profile, Squad, SquadStaff } from "./types";

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
