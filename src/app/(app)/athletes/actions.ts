"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireProfile } from "@/lib/auth";
import { bool, done, fail, isUuid, num, oneOf, safeNext, str } from "@/lib/forms";
import { heightToCm, massToKg } from "@/lib/units";

function athleteFields(fd: FormData, units: "metric" | "imperial") {
  const height = num(fd, "height");
  const mass = num(fd, "body_mass");
  const side = oneOf(fd, "dominant_side", ["", "left", "right", "both"] as const, "");
  const lang = oneOf(fd, "preferred_language", ["", "en", "he"] as const, "");
  return {
    full_name: str(fd, "full_name", 120),
    email: str(fd, "email", 320)?.toLowerCase() ?? null,
    phone: str(fd, "phone", 40),
    date_of_birth: str(fd, "date_of_birth", 10),
    gender: str(fd, "gender", 40),
    preferred_language: lang || null,
    emergency_contact: str(fd, "emergency_contact", 300),
    sport: str(fd, "sport", 80),
    team_name: str(fd, "team_name", 120),
    club: str(fd, "club", 120),
    position: str(fd, "position", 80),
    competitive_level: str(fd, "competitive_level", 80),
    training_age_years: num(fd, "training_age_years"),
    current_season: str(fd, "current_season", 80),
    dominant_side: side || null,
    short_term_goals: str(fd, "short_term_goals"),
    long_term_goals: str(fd, "long_term_goals"),
    height_cm: height == null ? null : heightToCm(height, units),
    body_mass_kg: mass == null ? null : massToKg(mass, units),
    training_availability: str(fd, "training_availability"),
    equipment_availability: str(fd, "equipment_availability"),
    injury_history: str(fd, "injury_history"),
    limitations: str(fd, "limitations"),
    rehab_status: str(fd, "rehab_status"),
    training_modifications: str(fd, "training_modifications"),
  };
}

export async function createAthlete(formData: FormData) {
  const { supabase, user, profile, t } = await requireProfile();
  const fields = athleteFields(formData, profile.units);
  if (!fields.full_name) fail("/athletes/new", t.common.required);
  // The id is generated here and the row inserted without RETURNING: read access comes
  // from the relationship row an AFTER trigger creates in the same statement.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("athletes").insert({ ...fields, id, owner_coach_id: user.id });
  if (error) fail("/athletes/new", error.message);
  revalidatePath("/athletes");
  redirect(`/athletes/${id}`);
}

export async function updateAthlete(formData: FormData) {
  const { supabase, profile, t } = await requireProfile();
  const id = str(formData, "id", 64);
  if (!isUuid(id)) fail("/athletes", t.common.notFound);
  const fields = athleteFields(formData, profile.units);
  if (!fields.full_name) fail(`/athletes/${id}/edit`, t.common.required);
  const { data, error } = await supabase.from("athletes").update(fields).eq("id", id).select("id");
  if (error) fail(`/athletes/${id}/edit`, error.message);
  if (!data?.length) fail(`/athletes/${id}`, t.common.notAllowed);
  revalidatePath(`/athletes/${id}`);
  done(`/athletes/${id}`, t.common.saved);
}

export async function setAthleteStatus(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const id = str(formData, "id", 64);
  const status = oneOf(formData, "status", ["active", "archived"] as const, "active");
  if (!isUuid(id)) fail("/athletes", t.common.notFound);
  const { error } = await supabase.from("athletes").update({ status }).eq("id", id);
  if (error) fail(`/athletes/${id}`, t.common.notAllowed);
  revalidatePath("/athletes");
  done(`/athletes/${id}`, t.common.saved);
}

export async function addNote(formData: FormData) {
  const { supabase, user, t } = await requireProfile();
  const athleteId = str(formData, "athlete_id", 64);
  const body = str(formData, "body", 5000);
  if (!isUuid(athleteId)) fail("/athletes", t.common.notFound);
  if (!body) fail(`/athletes/${athleteId}`, t.common.required);
  const { error } = await supabase.from("athlete_notes").insert({
    athlete_id: athleteId,
    author_id: user.id,
    body,
    shared_with_athlete: bool(formData, "shared"),
  });
  if (error) fail(`/athletes/${athleteId}`, t.common.notAllowed);
  revalidatePath(`/athletes/${athleteId}`);
  redirect(`/athletes/${athleteId}`);
}

export async function deleteNote(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const id = str(formData, "id", 64);
  const athleteId = str(formData, "athlete_id", 64);
  if (!isUuid(id) || !isUuid(athleteId)) fail("/athletes", t.common.notFound);
  await supabase.from("athlete_notes").delete().eq("id", id);
  revalidatePath(`/athletes/${athleteId}`);
  redirect(`/athletes/${athleteId}`);
}

export async function endRelationship(formData: FormData) {
  const { supabase, t } = await getSession();
  const id = str(formData, "relationship_id", 64);
  const back = safeNext(str(formData, "back", 200));
  if (!isUuid(id)) fail(back, t.common.notFound);
  const { error } = await supabase.rpc("end_relationship", { p_relationship: id });
  if (error) fail(back, t.common.notAllowed);
  revalidatePath(back);
  done(back, t.common.saved);
}
