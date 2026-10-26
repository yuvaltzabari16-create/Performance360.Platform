"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { done, fail, oneOf, safeNext, str, uuid } from "@/lib/forms";
import { ORG_ROLES } from "@/lib/types";

const errorText = (message: string, fallback: string, lastDirector: string) =>
  message.includes("at least one director") ? lastDirector : message.includes("not allowed") || message.includes("only the director") ? fallback : message;

export async function createInvite(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const role = oneOf(formData, "org_role", ORG_ROLES, "head_coach");
  const { error } = await supabase.rpc("create_staff_invite", { p_org_role: role });
  if (error) fail("/team", errorText(error.message, t.common.notAllowed, t.team.lastDirector));
  revalidatePath("/team");
  done("/team", t.team.inviteCreated);
}

export async function revokeCode(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const id = uuid(formData, "id");
  if (!id) fail("/team", t.common.notFound);
  const { error } = await supabase.rpc("revoke_org_code", { p_code_id: id });
  if (error) fail("/team", t.common.notAllowed);
  revalidatePath("/team");
  done("/team", t.common.saved);
}

export async function regenerateAthleteCode() {
  const { supabase, t } = await requireProfile();
  const { error } = await supabase.rpc("regenerate_org_athlete_code");
  if (error) fail("/team", t.common.notAllowed);
  revalidatePath("/team");
  done("/team", t.common.saved);
}

export async function changeMemberRole(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const user = uuid(formData, "user_id");
  if (!user) fail("/team", t.common.notFound);
  const { error } = await supabase.rpc("set_org_member_role", { p_user: user, p_org_role: oneOf(formData, "org_role", ORG_ROLES, "other_staff") });
  if (error) fail("/team", errorText(error.message, t.common.notAllowed, t.team.lastDirector));
  revalidatePath("/team");
  done("/team", t.team.roleChanged);
}

export async function removeMember(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const user = uuid(formData, "user_id");
  if (!user) fail("/team", t.common.notFound);
  const { error } = await supabase.rpc("remove_org_member", { p_user: user });
  if (error) fail("/team", errorText(error.message, t.common.notAllowed, t.team.lastDirector));
  revalidatePath("/", "layout");
  done("/team", t.team.removedMember);
}

export async function leaveTeam() {
  const { supabase, user, t } = await requireProfile();
  const { error } = await supabase.rpc("remove_org_member", { p_user: user.id });
  if (error) fail("/team", errorText(error.message, t.common.notAllowed, t.team.lastDirector));
  revalidatePath("/", "layout");
  redirect(`/dashboard?ok=${encodeURIComponent(t.team.left)}`);
}

export async function addToRoster(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const athlete = uuid(formData, "athlete_id");
  if (!athlete) fail("/athletes", t.common.notFound);
  const { data, error } = await supabase.rpc("add_athlete_to_roster", { p_athlete: athlete });
  const back = `/athletes/${athlete}`;
  if (error) fail(back, t.common.notAllowed);
  revalidatePath(back);
  switch (data as string) {
    case "added": done(back, t.common.saved);
    case "already_on_roster": done(back, t.team.alreadyOnRoster);
    case "needs_athlete_consent": fail(back, t.team.needsConsent);
    default: fail(back, t.team.notAllowed);
  }
}

export async function removeFromRoster(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const athlete = uuid(formData, "athlete_id");
  if (!athlete) fail("/athletes", t.common.notFound);
  const back = safeNext(str(formData, "back", 200), "/team");
  const { error } = await supabase.rpc("remove_athlete_from_roster", { p_athlete: athlete });
  if (error) fail(back, t.common.notAllowed);
  revalidatePath("/", "layout");
  done(back, t.common.saved);
}

/** An already set-up professional joining a team with a staff invitation. */
export async function joinTeamExisting(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const code = (str(formData, "code", 20) ?? "").toUpperCase();
  const back = `/team/join?code=${code}`;
  if (!/^STAFF-[A-Z0-9]{6}$/.test(code)) fail("/team/join", t.onboarding.invalidStaffCode);
  const { data, error } = await supabase.rpc("join_organization", { p_code: code, p_full_name: null });
  if (error) fail(back, error.message);
  revalidatePath("/", "layout");
  switch (data as string) {
    case "joined": redirect(`/team?ok=${encodeURIComponent(t.team.joined)}`);
    case "already_member": fail(back, t.onboarding.alreadyMember);
    case "not_allowed": fail(back, t.onboarding.notAllowed);
    default: fail(back, t.onboarding.invalidStaffCode);
  }
}

/** Squads: organised by the director and the head of performance; the database enforces who may. */
export async function createSquad(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const name = str(formData, "name", 60);
  if (!name) fail("/team", t.common.required);
  const { error } = await supabase.rpc("create_squad", { p_name: name });
  if (error) fail("/team", error.message.includes("already exists") ? t.team.squads.duplicate : t.common.notAllowed);
  revalidatePath("/", "layout");
  done("/team", t.common.saved);
}

export async function archiveSquad(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const id = uuid(formData, "squad_id");
  if (!id) fail("/team", t.common.notFound);
  const { error } = await supabase.rpc("archive_squad", { p_squad: id });
  if (error) fail("/team", t.common.notAllowed);
  revalidatePath("/", "layout");
  done("/team", t.common.saved);
}

/** The form lists every coach of the team; checked ones are switched on, the rest off. */
export async function saveSquadCoaches(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const id = uuid(formData, "squad_id");
  if (!id) fail("/team", t.common.notFound);
  const on = new Set(formData.getAll("on").map(String));
  for (const raw of formData.getAll("coach")) {
    const user = String(raw);
    if (!/^[0-9a-f-]{36}$/i.test(user)) continue;
    const { error } = await supabase.rpc("set_squad_coach", { p_squad: id, p_user: user, p_on: on.has(user) });
    if (error) fail("/team", t.common.notAllowed);
  }
  revalidatePath("/", "layout");
  done("/team", t.common.saved);
}

export async function setAthleteSquad(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const athlete = uuid(formData, "athlete_id");
  if (!athlete) fail("/team", t.common.notFound);
  const squad = uuid(formData, "squad_id");
  const { error } = await supabase.rpc("set_athlete_squad", { p_athlete: athlete, p_squad: squad ?? null });
  if (error) fail("/team", t.common.notAllowed);
  revalidatePath("/", "layout");
  done("/team", t.common.saved);
}
