"use server";

import { revalidatePath } from "next/cache";
import { getMyAthleteId, requireSection } from "@/lib/auth";
import { done, fail, int, num, safeNext, str, uuid } from "@/lib/forms";
import { contentProblem, fileProblem, toByteaHex } from "@/lib/files/rules";
import { isIsoDay, isMealPhotoName, isMealType } from "@/lib/nutrition";

const backOf = (fd: FormData) => safeNext(str(fd, "back", 300), "/nutrition");

/** The athlete logs a meal for a day, with an optional photo. Row-level security limits it to their own record. */
export async function logMeal(formData: FormData) {
  const { supabase, profile, t } = await requireSection("nutrition");
  const tn = t.nutrition;
  const back = backOf(formData);
  const athleteId = profile.role === "athlete" ? await getMyAthleteId() : null;
  if (!athleteId) fail(back, tn.notConnected);
  const mealType = str(formData, "meal_type", 20);
  const description = str(formData, "description", 1000);
  if (!isMealType(mealType) || !description) fail(back, t.common.required);
  const eatenOn = str(formData, "eaten_on", 10);
  const { data: meal, error } = await supabase.from("meal_logs").insert({
    athlete_id: athleteId,
    eaten_on: isIsoDay(eatenOn) ? eatenOn : new Date().toISOString().slice(0, 10),
    meal_type: mealType,
    description,
    calories: int(formData, "calories"),
    protein_g: num(formData, "protein_g"),
    carbs_g: num(formData, "carbs_g"),
    fat_g: num(formData, "fat_g"),
    water_ml: int(formData, "water_ml"),
  }).select("id").single();
  if (error || !meal) fail(back, t.common.error);
  revalidatePath("/nutrition");

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const ok = isMealPhotoName(photo.name) && !fileProblem(photo.name, photo.size) && !contentProblem(photo.name, bytes);
    const added = ok ? await supabase.rpc("add_attachment", { p_kind: "meal", p_ref: meal.id, p_athlete: null, p_name: photo.name, p_data: toByteaHex(bytes) }) : null;
    const linked = added && !added.error ? await supabase.rpc("set_meal_photo", { p_meal: meal.id, p_attachment: added.data }) : null;
    if (!linked || linked.error) fail(back, tn.photoFailed);
  }
  done(back, tn.saved);
}

export async function deleteMeal(formData: FormData) {
  const { supabase, t } = await requireSection("nutrition");
  const back = backOf(formData);
  const id = uuid(formData, "id");
  if (!id) fail(back, t.common.error);
  const { error, count } = await supabase.from("meal_logs").delete({ count: "exact" }).eq("id", id);
  if (error || !count) fail(back, t.common.error);
  revalidatePath("/nutrition");
  done(back, t.nutrition.deleted);
}

/** Staff who work with the athlete comment on a meal (an empty comment removes it). */
export async function commentMeal(formData: FormData) {
  const { supabase, t } = await requireSection("nutrition");
  const back = backOf(formData);
  const id = uuid(formData, "id");
  if (!id) fail(back, t.common.error);
  const { error } = await supabase.rpc("comment_on_meal", { p_meal: id, p_comment: str(formData, "comment", 1000) ?? "" });
  if (error) fail(back, t.common.error);
  revalidatePath("/nutrition");
  done(back, t.nutrition.commentSaved);
}
