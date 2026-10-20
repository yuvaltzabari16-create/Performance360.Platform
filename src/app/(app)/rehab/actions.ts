"use server";

import { revalidatePath } from "next/cache";
import { requireAthlete, requireProfessional } from "@/lib/auth";
import { done, fail, isUuid, lines, oneOf, str } from "@/lib/forms";

const back = (athleteId: string | null) => (athleteId ? `/rehab?athlete=${athleteId}` : "/rehab");

// Every write below is checked again by row level security / SECURITY DEFINER
// functions in the database; these guards only give clearer messages.

export async function createPlan(formData: FormData) {
  const { supabase, user, t } = await requireProfessional();
  const athleteId = str(formData, "athlete_id", 64);
  const title = str(formData, "title", 160);
  if (!isUuid(athleteId)) fail("/rehab", t.common.error);
  if (!title) fail(back(athleteId), t.common.required);
  const { error } = await supabase.from("rtp_plans").insert({
    athlete_id: athleteId, created_by: user.id, title, context: str(formData, "context", 4000),
  });
  if (error) fail(back(athleteId), t.common.notAllowed);
  revalidatePath("/rehab");
  done(back(athleteId), t.rehab.planCreated);
}

export async function setPlanStatus(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const athleteId = str(formData, "athlete_id", 64);
  const planId = str(formData, "plan_id", 64);
  const status = oneOf(formData, "status", ["active", "completed", "cancelled"] as const, "active");
  if (!isUuid(planId)) fail(back(athleteId), t.common.error);
  const { error } = await supabase.from("rtp_plans").update({ status }).eq("id", planId);
  if (error) fail(back(athleteId), t.common.notAllowed);
  revalidatePath("/rehab");
  done(back(athleteId), t.common.saved);
}

export async function addPhase(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const athleteId = str(formData, "athlete_id", 64);
  const planId = str(formData, "plan_id", 64);
  const title = str(formData, "title", 160);
  if (!isUuid(planId)) fail(back(athleteId), t.common.error);
  if (!title) fail(back(athleteId), t.common.required);
  const { data: last } = await supabase.from("rtp_phases").select("position").eq("plan_id", planId)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  const position = ((last?.position as number | undefined) ?? 0) + 1;
  if (position > 20) fail(back(athleteId), t.common.error);
  const { error } = await supabase.from("rtp_phases").insert({
    plan_id: planId, position, title,
    description: str(formData, "description", 4000),
    criteria: lines(formData, "criteria").slice(0, 20).map((c) => c.slice(0, 300)),
  });
  if (error) fail(back(athleteId), t.common.notAllowed);
  revalidatePath("/rehab");
  done(back(athleteId), t.common.saved);
}

export async function addExercise(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const athleteId = str(formData, "athlete_id", 64);
  const phaseId = str(formData, "phase_id", 64);
  const name = str(formData, "name", 160);
  if (!isUuid(phaseId)) fail(back(athleteId), t.common.error);
  if (!name) fail(back(athleteId), t.common.required);
  const { error } = await supabase.from("rtp_phase_exercises").insert({
    phase_id: phaseId, name, prescription: str(formData, "prescription", 1000),
  });
  if (error) fail(back(athleteId), t.common.notAllowed);
  revalidatePath("/rehab");
  done(back(athleteId), t.common.saved);
}

export async function setPhaseStatus(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const athleteId = str(formData, "athlete_id", 64);
  const phaseId = str(formData, "phase_id", 64);
  const status = oneOf(formData, "status", ["locked", "in_progress", "cleared"] as const, "in_progress");
  if (!isUuid(phaseId)) fail(back(athleteId), t.common.error);
  const { error } = await supabase.rpc("set_rtp_phase_status", {
    p_phase: phaseId,
    p_status: status,
    p_cleared_by_name: str(formData, "cleared_by_name", 160),
    p_cleared_by_role: str(formData, "cleared_by_role", 80),
    p_note: str(formData, "note", 4000),
  });
  // Database messages (e.g. "record the name of the professional…") are written for people.
  if (error) fail(back(athleteId), error.message || t.common.notAllowed);
  revalidatePath("/rehab");
  done(back(athleteId), t.common.saved);
}

export async function logExercise(formData: FormData) {
  const { supabase, t } = await requireAthlete();
  const exerciseId = str(formData, "exercise_id", 64);
  if (!isUuid(exerciseId)) fail("/rehab", t.common.error);
  const { error } = await supabase.rpc("log_rtp_exercise", { p_exercise: exerciseId });
  if (error) fail("/rehab", error.message || t.common.notAllowed);
  revalidatePath("/rehab");
  done("/rehab", t.rehab.logged);
}
