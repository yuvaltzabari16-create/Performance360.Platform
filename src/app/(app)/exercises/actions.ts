"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional, requireProfile } from "@/lib/auth";
import { csv, done, fail, isUuid, lines, oneOf, str } from "@/lib/forms";
import { DIFFICULTIES, EXERCISE_CATEGORIES } from "@/lib/catalog";

function httpsOrNull(v: string | null) {
  return v && /^https:\/\//i.test(v) ? v : null;
}

function exerciseFields(fd: FormData) {
  return {
    name: str(fd, "name", 160),
    description: str(fd, "description"),
    category: oneOf(fd, "category", EXERCISE_CATEGORIES, "strength"),
    primary_objective: str(fd, "primary_objective", 300),
    movement_pattern: str(fd, "movement_pattern", 120),
    primary_muscles: csv(fd, "primary_muscles"),
    equipment: csv(fd, "equipment"),
    difficulty: oneOf(fd, "difficulty", DIFFICULTIES, "intermediate"),
    coaching_cues: lines(fd, "coaching_cues"),
    common_errors: lines(fd, "common_errors"),
    regressions: str(fd, "regressions"),
    progressions: str(fd, "progressions"),
    modification_notes: str(fd, "modification_notes"),
    suggested_prescription: str(fd, "suggested_prescription", 500),
    video_url: httpsOrNull(str(fd, "video_url", 500)),
    thumbnail_url: httpsOrNull(str(fd, "thumbnail_url", 500)),
    tags: csv(fd, "tags"),
    source: str(fd, "source", 500),
  };
}

export async function createExercise(formData: FormData) {
  const { supabase, user, t } = await requireProfessional();
  const fields = exerciseFields(formData);
  if (!fields.name) fail("/exercises/new", t.common.required);
  const { data, error } = await supabase.from("exercises").insert({ ...fields, owner_id: user.id }).select("id").single();
  if (error || !data) fail("/exercises/new", error?.message ?? t.common.error);
  revalidatePath("/exercises");
  redirect(`/exercises/${data.id}`);
}

export async function updateExercise(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = str(formData, "id", 64);
  if (!isUuid(id)) fail("/exercises", t.common.notFound);
  const fields = exerciseFields(formData);
  if (!fields.name) fail(`/exercises/${id}/edit`, t.common.required);
  const { data, error } = await supabase.from("exercises").update(fields).eq("id", id).select("id");
  if (error) fail(`/exercises/${id}/edit`, error.message);
  if (!data?.length) fail(`/exercises/${id}`, t.common.notAllowed);
  revalidatePath(`/exercises/${id}`);
  done(`/exercises/${id}`, t.common.saved);
}

export async function duplicateExercise(formData: FormData) {
  const { supabase, user, t } = await requireProfessional();
  const id = str(formData, "id", 64);
  if (!isUuid(id)) fail("/exercises", t.common.notFound);
  const { data: src } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (!src) fail("/exercises", t.common.notFound);
  const { id: _id, owner_id: _o, created_at: _c, updated_at: _u, ...rest } = src;
  void _id; void _o; void _c; void _u;
  const { data, error } = await supabase
    .from("exercises")
    .insert({ ...rest, owner_id: user.id, source: rest.source ? `${rest.source} (copy)` : null })
    .select("id")
    .single();
  if (error || !data) fail(`/exercises/${id}`, error?.message ?? t.common.error);
  redirect(`/exercises/${data.id}/edit`);
}

export async function archiveExercise(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = str(formData, "id", 64);
  if (!isUuid(id)) fail("/exercises", t.common.notFound);
  // Archived rather than deleted so programs referencing it keep their history.
  const { data } = await supabase.from("exercises").update({ archived: true }).eq("id", id).select("id");
  if (!data?.length) fail(`/exercises/${id}`, t.common.notAllowed);
  revalidatePath("/exercises");
  done("/exercises", t.common.saved);
}

export async function toggleFavorite(formData: FormData) {
  const { supabase, user } = await requireProfile();
  const id = str(formData, "id", 64);
  const back = str(formData, "back", 300);
  if (!isUuid(id)) return;
  const { data: existing } = await supabase.from("exercise_favorites").select("exercise_id").eq("exercise_id", id).eq("user_id", user.id).maybeSingle();
  if (existing) await supabase.from("exercise_favorites").delete().eq("exercise_id", id).eq("user_id", user.id);
  else await supabase.from("exercise_favorites").insert({ exercise_id: id, user_id: user.id });
  revalidatePath("/exercises");
  redirect(back && back.startsWith("/exercises") ? back : `/exercises/${id}`);
}
