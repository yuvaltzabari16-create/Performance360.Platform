"use server";

import { revalidatePath } from "next/cache";
import { requireProfessional } from "@/lib/auth";
import { FIELD_COLUMNS, isFieldKey, parseField } from "@/lib/builder-fields";
import { SESSION_SECTIONS } from "@/lib/catalog";
import { isUuid } from "@/lib/forms";

// Server actions behind the workout builder. They return a result instead of redirecting so the
// builder can update in place. Ownership is enforced by row-level security on session_exercises.

export type BuilderResult = { ok: true } | { ok: false; error: string };

const refresh = (programId: string) => revalidatePath(`/training/${programId}`);

export async function patchExerciseField(input: { id: string; programId: string; field: string; value: string }): Promise<BuilderResult> {
  const { supabase, t } = await requireProfessional();
  if (!isUuid(input.id) || !isUuid(input.programId) || !isFieldKey(input.field)) return { ok: false, error: t.common.error };
  const parsed = parseField(input.field, String(input.value ?? ""));
  if (!parsed.ok) return { ok: false, error: t.training.builder.invalidValue };
  // Only the columns that belong to this field can change.
  const patch = Object.fromEntries(Object.entries(parsed.patch).filter(([k]) => (FIELD_COLUMNS[input.field as keyof typeof FIELD_COLUMNS] as string[]).includes(k)));
  const { data, error } = await supabase.from("session_exercises").update(patch).eq("id", input.id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: t.common.notAllowed };
  refresh(input.programId);
  return { ok: true };
}

export async function addExerciseToSession(input: {
  sessionId: string; programId: string; section: string; exerciseId?: string | null; name?: string | null;
}): Promise<BuilderResult> {
  const { supabase, t } = await requireProfessional();
  if (!isUuid(input.sessionId) || !isUuid(input.programId)) return { ok: false, error: t.common.error };
  const section = (SESSION_SECTIONS as readonly string[]).includes(input.section) ? input.section : "strength";
  let name = (input.name ?? "").trim().slice(0, 160);
  let exerciseId: string | null = null;
  if (input.exerciseId) {
    if (!isUuid(input.exerciseId)) return { ok: false, error: t.common.error };
    const { data: ex } = await supabase.from("exercises").select("id, name").eq("id", input.exerciseId).maybeSingle();
    if (!ex) return { ok: false, error: t.common.notFound };
    exerciseId = ex.id;
    name = ex.name;
  }
  if (!name) return { ok: false, error: t.common.required };
  const { data: last } = await supabase.from("session_exercises").select("position").eq("session_id", input.sessionId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("session_exercises").insert({
    session_id: input.sessionId, exercise_id: exerciseId, exercise_name: name, section, position: (last?.position ?? -1) + 1,
  });
  if (error) return { ok: false, error: error.message };
  refresh(input.programId);
  return { ok: true };
}

export async function removeExercise(input: { id: string; programId: string }): Promise<BuilderResult> {
  const { supabase, t } = await requireProfessional();
  if (!isUuid(input.id) || !isUuid(input.programId)) return { ok: false, error: t.common.error };
  const { error } = await supabase.from("session_exercises").delete().eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  refresh(input.programId);
  return { ok: true };
}

export async function duplicateExercise(input: { id: string; programId: string }): Promise<BuilderResult> {
  const { supabase, t } = await requireProfessional();
  if (!isUuid(input.id) || !isUuid(input.programId)) return { ok: false, error: t.common.error };
  const { data: src } = await supabase.from("session_exercises").select("*").eq("id", input.id).maybeSingle();
  if (!src) return { ok: false, error: t.common.notFound };
  const { data: last } = await supabase.from("session_exercises").select("position").eq("session_id", src.session_id).order("position", { ascending: false }).limit(1).maybeSingle();
  const { id: _id, created_at: _c, updated_at: _u, ...copy } = src as Record<string, unknown>;
  void _id; void _c; void _u;
  const { error } = await supabase.from("session_exercises").insert({ ...copy, position: (last?.position ?? -1) + 1 });
  if (error) return { ok: false, error: error.message };
  refresh(input.programId);
  return { ok: true };
}

/** Swaps the order of two exercises of the same session (neighbours within a block). */
export async function swapExercises(input: { a: string; b: string; programId: string }): Promise<BuilderResult> {
  const { supabase, t } = await requireProfessional();
  if (!isUuid(input.a) || !isUuid(input.b) || !isUuid(input.programId)) return { ok: false, error: t.common.error };
  const { data } = await supabase.from("session_exercises").select("id, session_id, position").in("id", [input.a, input.b]);
  if (!data || data.length !== 2 || data[0].session_id !== data[1].session_id) return { ok: false, error: t.common.error };
  const [x, y] = data;
  // Equal positions would make the swap a no-op, so fall back to explicit distinct values.
  const px = x.position === y.position ? y.position + 1 : y.position;
  const py = x.position === y.position ? x.position : x.position;
  const r1 = await supabase.from("session_exercises").update({ position: px }).eq("id", x.id);
  const r2 = await supabase.from("session_exercises").update({ position: py }).eq("id", y.id);
  if (r1.error || r2.error) return { ok: false, error: (r1.error ?? r2.error)!.message };
  refresh(input.programId);
  return { ok: true };
}
