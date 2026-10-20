"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional, requireProfile } from "@/lib/auth";
import { CYCLE_LEVELS, PROGRAM_TYPES, SESSION_SECTIONS } from "@/lib/catalog";
import { bool, done, fail, int, isUuid, num, oneOf, str, uuid } from "@/lib/forms";
import { todayFor } from "@/lib/dates.server";

const clampWeek = (n: number | null, fallback = 1) => Math.min(104, Math.max(1, n ?? fallback));
const clampDay = (n: number | null, fallback = 1) => Math.min(7, Math.max(1, n ?? fallback));

function programPath(id: string, week?: number | null) {
  return `/training/${id}${week ? `?week=${week}` : ""}`;
}

export async function createProgram(formData: FormData) {
  const { supabase, user, t } = await requireProfessional();
  const title = str(formData, "title", 160);
  if (!title) fail("/training/new", t.common.required);
  const { data, error } = await supabase
    .from("training_programs")
    .insert({
      coach_id: user.id,
      title,
      description: str(formData, "description"),
      program_type: oneOf(formData, "program_type", PROGRAM_TYPES, "block"),
      sport: str(formData, "sport", 80),
      goal: str(formData, "goal", 300),
      num_weeks: clampWeek(int(formData, "num_weeks"), 4),
      is_template: bool(formData, "is_template"),
    })
    .select("id")
    .single();
  if (error || !data) fail("/training/new", error?.message ?? t.common.error);
  redirect(`/training/${data.id}`);
}

export async function updateProgram(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = uuid(formData, "id");
  if (!id) fail("/training", t.common.notFound);
  const title = str(formData, "title", 160);
  if (!title) fail(programPath(id), t.common.required);
  const { data, error } = await supabase
    .from("training_programs")
    .update({
      title,
      description: str(formData, "description"),
      program_type: oneOf(formData, "program_type", PROGRAM_TYPES, "block"),
      sport: str(formData, "sport", 80),
      goal: str(formData, "goal", 300),
      num_weeks: clampWeek(int(formData, "num_weeks"), 4),
      status: oneOf(formData, "status", ["draft", "active", "archived"] as const, "draft"),
      is_template: bool(formData, "is_template"),
    })
    .eq("id", id)
    .select("id");
  if (error) fail(programPath(id), error.message);
  if (!data?.length) fail("/training", t.common.notAllowed);
  revalidatePath(`/training/${id}`);
  done(programPath(id), t.common.saved);
}

export async function duplicateProgram(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = uuid(formData, "id");
  if (!id) fail("/training", t.common.notFound);
  const { data, error } = await supabase.rpc("duplicate_program", {
    p_program: id,
    p_as_template: bool(formData, "as_template"),
    p_title: str(formData, "title", 160),
  });
  if (error || !data) fail(programPath(id), t.common.notAllowed);
  redirect(`/training/${data}`);
}

export async function addPhase(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const programId = uuid(formData, "program_id");
  if (!programId) fail("/training", t.common.notFound);
  const name = str(formData, "name", 120);
  const start = clampWeek(int(formData, "start_week"));
  const end = Math.max(start, clampWeek(int(formData, "end_week"), start));
  if (!name) fail(programPath(programId), t.common.required);
  const { error } = await supabase.from("program_phases").insert({
    program_id: programId,
    name,
    cycle_level: oneOf(formData, "cycle_level", CYCLE_LEVELS, "mesocycle"),
    start_week: start,
    end_week: end,
    objective: str(formData, "objective", 1000),
  });
  if (error) fail(programPath(programId), t.common.notAllowed);
  revalidatePath(`/training/${programId}`);
  redirect(programPath(programId));
}

export async function deletePhase(formData: FormData) {
  const { supabase } = await requireProfessional();
  const id = uuid(formData, "id");
  const programId = uuid(formData, "program_id");
  if (id) await supabase.from("program_phases").delete().eq("id", id);
  redirect(programPath(programId ?? ""));
}

export async function addSession(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const programId = uuid(formData, "program_id");
  if (!programId) fail("/training", t.common.notFound);
  const week = clampWeek(int(formData, "week_number"));
  const title = str(formData, "title", 160);
  if (!title) fail(programPath(programId, week), t.common.required);
  const { error } = await supabase.from("training_sessions").insert({
    program_id: programId,
    week_number: week,
    day_number: clampDay(int(formData, "day_number")),
    title,
    planned_duration_min: int(formData, "planned_duration_min"),
    notes: str(formData, "notes"),
  });
  if (error) fail(programPath(programId, week), error.message);
  revalidatePath(`/training/${programId}`);
  redirect(programPath(programId, week));
}

export async function updateSession(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = uuid(formData, "id");
  const programId = uuid(formData, "program_id");
  const week = clampWeek(int(formData, "week_number"));
  if (!id || !programId) fail("/training", t.common.notFound);
  const title = str(formData, "title", 160);
  if (!title) fail(programPath(programId, week), t.common.required);
  const { error } = await supabase
    .from("training_sessions")
    .update({ title, day_number: clampDay(int(formData, "day_number")), week_number: week, planned_duration_min: int(formData, "planned_duration_min"), notes: str(formData, "notes") })
    .eq("id", id);
  if (error) fail(programPath(programId, week), error.message);
  redirect(programPath(programId, week));
}

export async function deleteSession(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = uuid(formData, "id");
  const programId = uuid(formData, "program_id");
  const week = int(formData, "week");
  if (!id || !programId) fail("/training", t.common.notFound);
  const { error } = await supabase.from("training_sessions").delete().eq("id", id);
  if (error) fail(programPath(programId, week), error.message);
  redirect(programPath(programId, week));
}

export async function copySession(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = uuid(formData, "id");
  const programId = uuid(formData, "program_id");
  if (!id || !programId) fail("/training", t.common.notFound);
  const week = clampWeek(int(formData, "target_week"));
  const { error } = await supabase.rpc("copy_session", { p_session: id, p_week: week, p_day: clampDay(int(formData, "target_day")) });
  if (error) fail(programPath(programId), t.common.notAllowed);
  redirect(programPath(programId, week));
}

export async function duplicateWeek(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const programId = uuid(formData, "program_id");
  if (!programId) fail("/training", t.common.notFound);
  const from = clampWeek(int(formData, "from_week"));
  const to = clampWeek(int(formData, "to_week"));
  if (from === to) fail(programPath(programId, from), t.common.error);
  const { error } = await supabase.rpc("duplicate_week", { p_program: programId, p_from: from, p_to: to });
  if (error) fail(programPath(programId, from), t.common.notAllowed);
  redirect(programPath(programId, to));
}

function exerciseRowFields(fd: FormData) {
  return {
    section: oneOf(fd, "section", SESSION_SECTIONS, "strength"),
    sets: int(fd, "sets"),
    reps: str(fd, "reps", 40),
    duration_s: int(fd, "duration_s"),
    distance_m: num(fd, "distance_m"),
    load_kg: num(fd, "load_kg"),
    percent_1rm: num(fd, "percent_1rm"),
    tempo: str(fd, "tempo", 20),
    rest_s: int(fd, "rest_s"),
    intensity_target: str(fd, "intensity_target", 120),
    rpe: num(fd, "rpe"),
    rir: int(fd, "rir"),
    cues: str(fd, "cues", 1000),
    modifications: str(fd, "modifications", 1000),
    notes: str(fd, "notes", 1000),
  };
}

export async function addSessionExercise(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const sessionId = uuid(formData, "session_id");
  const programId = uuid(formData, "program_id");
  const week = int(formData, "week");
  if (!sessionId || !programId) fail("/training", t.common.notFound);
  const exerciseId = uuid(formData, "exercise_id");
  let name = str(formData, "exercise_name", 160);
  if (exerciseId) {
    const { data: ex } = await supabase.from("exercises").select("name").eq("id", exerciseId).maybeSingle();
    if (!ex) fail(programPath(programId, week), t.common.notFound);
    name = ex.name;
  }
  if (!name) fail(programPath(programId, week), t.common.required);
  const { data: last } = await supabase.from("session_exercises").select("position").eq("session_id", sessionId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("session_exercises").insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    exercise_name: name,
    position: (last?.position ?? -1) + 1,
    ...exerciseRowFields(formData),
  });
  if (error) fail(programPath(programId, week), error.message);
  redirect(programPath(programId, week));
}

export async function updateSessionExercise(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = uuid(formData, "id");
  const programId = uuid(formData, "program_id");
  const week = int(formData, "week");
  if (!id || !programId) fail("/training", t.common.notFound);
  const { error } = await supabase.from("session_exercises").update(exerciseRowFields(formData)).eq("id", id);
  if (error) fail(programPath(programId, week), error.message);
  redirect(programPath(programId, week));
}

export async function deleteSessionExercise(formData: FormData) {
  const { supabase } = await requireProfessional();
  const id = uuid(formData, "id");
  const programId = uuid(formData, "program_id");
  const week = int(formData, "week");
  if (id) await supabase.from("session_exercises").delete().eq("id", id);
  redirect(programPath(programId ?? "", week));
}

export async function moveSessionExercise(formData: FormData) {
  const { supabase } = await requireProfessional();
  const id = uuid(formData, "id");
  const programId = uuid(formData, "program_id");
  const week = int(formData, "week");
  const dir = int(formData, "dir") === -1 ? -1 : 1;
  if (id) await supabase.rpc("move_session_exercise", { p_id: id, p_direction: dir });
  redirect(programPath(programId ?? "", week));
}

export async function assignProgram(formData: FormData) {
  const { supabase, user, t } = await requireProfessional();
  const programId = uuid(formData, "program_id");
  if (!programId) fail("/training", t.common.notFound);
  const startDate = str(formData, "start_date", 10) ?? (await todayFor());
  let athleteIds = formData.getAll("athlete_ids").filter((v): v is string => typeof v === "string" && isUuid(v));
  const teamId = uuid(formData, "team_id");
  if (teamId) {
    const { data: members } = await supabase.from("team_members").select("athlete_id").eq("team_id", teamId);
    athleteIds = [...new Set([...athleteIds, ...(members ?? []).map((m) => m.athlete_id as string)])];
  }
  if (athleteIds.length === 0) fail(programPath(programId), t.common.required);
  // Skip athletes who already have this program actively assigned (no duplicates).
  const { data: existing } = await supabase.from("program_assignments").select("athlete_id").eq("program_id", programId).eq("status", "active");
  const already = new Set((existing ?? []).map((e) => e.athlete_id));
  const rows = athleteIds.filter((a) => !already.has(a)).map((athlete_id) => ({ program_id: programId, athlete_id, assigned_by: user.id, start_date: startDate }));
  if (rows.length) {
    const { error } = await supabase.from("program_assignments").insert(rows);
    if (error) fail(programPath(programId), t.common.notAllowed);
    await supabase.from("training_programs").update({ status: "active" }).eq("id", programId).eq("status", "draft");
  }
  revalidatePath(`/training/${programId}`);
  done(programPath(programId), t.common.saved);
}

export async function cancelAssignment(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = uuid(formData, "id");
  const programId = uuid(formData, "program_id");
  if (!id || !programId) fail("/training", t.common.notFound);
  await supabase.from("program_assignments").update({ status: "cancelled" }).eq("id", id);
  done(programPath(programId), t.common.saved);
}

export async function saveVersion(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const programId = uuid(formData, "program_id");
  if (!programId) fail("/training", t.common.notFound);
  const { error } = await supabase.rpc("save_program_version", { p_program: programId, p_note: str(formData, "note", 300) });
  if (error) fail(programPath(programId), t.common.notAllowed);
  done(programPath(programId), t.common.saved);
}

/** Athlete (or one of their professionals) logs a completed session. */
export async function logSession(formData: FormData) {
  const { supabase, user, t } = await requireProfile();
  const sessionId = uuid(formData, "session_id");
  const athleteId = uuid(formData, "athlete_id");
  if (!sessionId || !athleteId) fail("/training", t.common.notFound);
  const back = `/training/session/${sessionId}?athlete=${athleteId}`;
  const completedOn = str(formData, "completed_on", 10) ?? (await todayFor());
  const rpe = num(formData, "session_rpe");
  if (rpe != null && (rpe < 0 || rpe > 10)) fail(back, t.training.sessionRpe);

  const { data: completion, error } = await supabase
    .from("workout_completions")
    .upsert(
      {
        session_id: sessionId,
        athlete_id: athleteId,
        completed_on: completedOn,
        status: oneOf(formData, "status", ["completed", "partial", "skipped"] as const, "completed"),
        duration_min: int(formData, "duration_min"),
        session_rpe: rpe,
        athlete_feedback: str(formData, "athlete_feedback", 2000),
        recorded_by: user.id,
      },
      { onConflict: "session_id,athlete_id,completed_on" },
    )
    .select("id")
    .single();
  if (error || !completion) fail(back, error?.message ?? t.common.notAllowed);

  const exerciseIds = formData.getAll("se_ids").filter((v): v is string => typeof v === "string" && isUuid(v));
  if (exerciseIds.length) {
    const logs = exerciseIds.map((seId) => ({
      completion_id: completion.id,
      session_exercise_id: seId,
      done: bool(formData, `done_${seId}`),
      actual_sets: int(formData, `sets_${seId}`),
      actual_reps: str(formData, `reps_${seId}`, 40),
      actual_load_kg: num(formData, `load_${seId}`),
      feedback: str(formData, `fb_${seId}`, 500),
    }));
    const { error: logError } = await supabase.from("exercise_logs").upsert(logs, { onConflict: "completion_id,session_exercise_id" });
    if (logError) fail(back, logError.message);
  }
  revalidatePath("/training");
  done(back, t.common.saved);
}
