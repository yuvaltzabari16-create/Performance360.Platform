"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfessional } from "@/lib/auth";
import { done, fail, isUuid, str, uuid } from "@/lib/forms";

export async function createTeam(formData: FormData) {
  const { supabase, user, t } = await requireProfessional();
  const name = str(formData, "name", 120);
  if (!name) fail("/teams", t.common.required);
  const { data, error } = await supabase
    .from("teams")
    .insert({ owner_id: user.id, name, sport: str(formData, "sport", 80), season: str(formData, "season", 80), description: str(formData, "description", 1000) })
    .select("id")
    .single();
  if (error || !data) fail("/teams", error?.message ?? t.common.error);
  redirect(`/teams/${data.id}`);
}

export async function updateTeam(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = uuid(formData, "id");
  if (!id) fail("/teams", t.common.notFound);
  const name = str(formData, "name", 120);
  if (!name) fail(`/teams/${id}`, t.common.required);
  await supabase.from("teams").update({ name, sport: str(formData, "sport", 80), season: str(formData, "season", 80), description: str(formData, "description", 1000) }).eq("id", id);
  done(`/teams/${id}`, t.common.saved);
}

export async function deleteTeam(formData: FormData) {
  const { supabase } = await requireProfessional();
  const id = uuid(formData, "id");
  // Deleting a team removes the grouping only; athletes and their data are untouched.
  if (id) await supabase.from("teams").delete().eq("id", id);
  revalidatePath("/teams");
  redirect("/teams");
}

export async function addMembers(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const teamId = uuid(formData, "team_id");
  if (!teamId) fail("/teams", t.common.notFound);
  const ids = formData.getAll("athlete_ids").filter((v): v is string => typeof v === "string" && isUuid(v));
  if (ids.length === 0) fail(`/teams/${teamId}`, t.common.required);
  const { error } = await supabase.from("team_members").upsert(ids.map((athlete_id) => ({ team_id: teamId, athlete_id })), { onConflict: "team_id,athlete_id", ignoreDuplicates: true });
  if (error) fail(`/teams/${teamId}`, t.common.notAllowed);
  done(`/teams/${teamId}`, t.common.saved);
}

export async function removeMember(formData: FormData) {
  const { supabase } = await requireProfessional();
  const teamId = uuid(formData, "team_id");
  const athleteId = uuid(formData, "athlete_id");
  if (teamId && athleteId) await supabase.from("team_members").delete().eq("team_id", teamId).eq("athlete_id", athleteId);
  redirect(`/teams/${teamId ?? ""}`);
}
