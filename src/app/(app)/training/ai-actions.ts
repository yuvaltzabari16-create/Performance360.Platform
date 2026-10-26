"use server";

import { revalidatePath } from "next/cache";
import { requireProfessional } from "@/lib/auth";
import { requestWorkout } from "@/lib/ai/provider";
import { buildPreview, type WorkoutPreview } from "@/lib/ai/workout";
import { FIELD_KEYS, parseField, type ExercisePatch, type FieldKey } from "@/lib/builder-fields";
import { SESSION_SECTIONS } from "@/lib/catalog";
import { isUuid } from "@/lib/forms";
import type { BuilderResult } from "./builder-actions";

// Server actions behind "Build with AI": generate a preview, then apply what the coach accepts.

export type PreviewResult = { ok: true; preview: WorkoutPreview } | { ok: false; error: string };

/** Asks the model for a session and returns a library-validated preview (nothing is saved yet). */
export async function generateWorkoutPreview(input: { prompt: string }): Promise<PreviewResult> {
  const { supabase, user, t } = await requireProfessional();
  const errors = t.training.builder.ai.errors;
  const prompt = String(input?.prompt ?? "").trim();
  if (prompt.length < 3) return { ok: false, error: errors.tooShort };

  const { data } = await supabase.from("exercises").select("id, name, category").eq("archived", false).order("name").limit(1000);
  const library = (data ?? []) as { id: string; name: string; category: string }[];
  if (library.length === 0) return { ok: false, error: errors.empty };

  const result = await requestWorkout(prompt, library, user.id);
  if (!result.ok) return { ok: false, error: errors[result.error] };
  const preview = buildPreview(result.raw, library);
  return preview ? { ok: true, preview } : { ok: false, error: errors.empty };
}

interface ApplyBlock { section: string; items: { exerciseId: string; values: Partial<Record<string, string>> }[] }

/** Saves an accepted preview into a session. Everything is re-validated here; the client is not trusted. */
export async function applyWorkoutPreview(input: { sessionId: string; programId: string; blocks: ApplyBlock[] }): Promise<BuilderResult> {
  const { supabase, t } = await requireProfessional();
  if (!isUuid(input?.sessionId) || !isUuid(input?.programId) || !Array.isArray(input.blocks)) return { ok: false, error: t.common.error };

  const flat = input.blocks.slice(0, 8).flatMap((b) =>
    (SESSION_SECTIONS as readonly string[]).includes(b?.section) && Array.isArray(b.items)
      ? b.items.slice(0, 8).filter((i) => isUuid(i?.exerciseId)).map((i) => ({ section: b.section, exerciseId: i.exerciseId, values: i.values ?? {} }))
      : [],
  );
  if (flat.length === 0) return { ok: false, error: t.common.required };

  const { data: found } = await supabase.from("exercises").select("id, name").in("id", [...new Set(flat.map((f) => f.exerciseId))]);
  const names = new Map((found ?? []).map((e) => [e.id as string, e.name as string]));
  const { data: last } = await supabase.from("session_exercises").select("position").eq("session_id", input.sessionId).order("position", { ascending: false }).limit(1).maybeSingle();

  let position = (last?.position ?? -1) + 1;
  const rows = [];
  for (const item of flat) {
    const name = names.get(item.exerciseId);
    if (!name) continue; // unknown or not visible to this coach
    const patch: ExercisePatch = {};
    for (const key of FIELD_KEYS) {
      const text = item.values[key as FieldKey];
      if (typeof text !== "string" || !text) continue;
      const parsed = parseField(key, text);
      if (parsed.ok) Object.assign(patch, parsed.patch);
    }
    rows.push({ session_id: input.sessionId, exercise_id: item.exerciseId, exercise_name: name, section: item.section, position: position++, ...patch });
  }
  if (rows.length === 0) return { ok: false, error: t.common.notFound };
  const { error } = await supabase.from("session_exercises").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/training/${input.programId}`);
  return { ok: true };
}
