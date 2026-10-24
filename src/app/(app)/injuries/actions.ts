"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { done, fail, oneOf, str, uuid } from "@/lib/forms";
import { BODY_AREAS, INJURY_KINDS, INJURY_STAGES, MECHANISMS, SEVERITIES, SIDES } from "@/lib/injury";

/** Where to return after an action: the athlete page, the board, or the athlete's own page. */
function backPath(fd: FormData): string {
  const back = str(fd, "back", 200) ?? "/injuries";
  return back.startsWith("/") && !back.startsWith("//") ? back : "/injuries";
}

function refresh(athleteId: string | null) {
  revalidatePath("/injuries");
  revalidatePath("/dashboard");
  if (athleteId) revalidatePath(`/athletes/${athleteId}`);
}

/** Message shown for the database's named errors; anything else gets the generic text. */
function reason(message: string, t: Awaited<ReturnType<typeof requireProfile>>["t"]): string {
  if (message.includes("clearance_note_required")) return t.injury.clearNote;
  if (message.includes("clearance_not_allowed")) return t.injury.clearanceBlocked;
  return t.common.error;
}

export async function reportInjury(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const back = backPath(formData);
  let athleteId = uuid(formData, "athlete_id");
  if (!athleteId) {
    // Athletes report for themselves; the record is created on first use.
    const { data } = await supabase.rpc("ensure_my_athlete_record");
    athleteId = (data as string | null) ?? null;
  }
  if (!athleteId) fail(back, t.common.error);
  const { error } = await supabase.rpc("report_injury", {
    p_athlete: athleteId,
    p_area: oneOf(formData, "body_area", BODY_AREAS, "other"),
    p_side: str(formData, "side", 10) && oneOf(formData, "side", SIDES, "both"),
    p_kind: oneOf(formData, "kind", INJURY_KINDS, "other"),
    p_mechanism: str(formData, "mechanism", 20) ? oneOf(formData, "mechanism", MECHANISMS, "unknown") : null,
    p_severity: str(formData, "severity", 20) ? oneOf(formData, "severity", SEVERITIES, "minor") : null,
    p_date: str(formData, "injury_date", 10),
    p_diagnosis: str(formData, "diagnosis", 2000),
    p_expected: str(formData, "expected_return", 10),
    p_note: str(formData, "note", 2000),
  });
  if (error) fail(back, reason(error.message, t));
  refresh(athleteId);
  done(back, t.injury.reported);
}

export async function changeInjuryStage(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const back = backPath(formData);
  const injury = uuid(formData, "injury_id");
  const stage = oneOf(formData, "stage", INJURY_STAGES, "rest");
  if (!injury) fail(back, t.common.error);
  const { error } = await supabase.rpc("set_injury_stage", { p_injury: injury, p_stage: stage, p_note: str(formData, "note", 2000) });
  if (error) fail(back, reason(error.message, t));
  refresh(uuid(formData, "athlete_id"));
  done(back, t.injury.saved);
}

export async function addInjuryNote(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const back = backPath(formData);
  const injury = uuid(formData, "injury_id");
  const note = str(formData, "note", 2000);
  if (!injury || !note) fail(back, t.common.error);
  const { error } = await supabase.rpc("add_injury_note", { p_injury: injury, p_note: note });
  if (error) fail(back, reason(error.message, t));
  refresh(uuid(formData, "athlete_id"));
  done(back, t.injury.saved);
}

export async function updateInjuryDetails(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const back = backPath(formData);
  const injury = uuid(formData, "injury_id");
  if (!injury) fail(back, t.common.error);
  const { error } = await supabase.rpc("update_injury_details", {
    p_injury: injury,
    p_diagnosis: str(formData, "diagnosis", 2000),
    p_expected: str(formData, "expected_return", 10),
    p_severity: str(formData, "severity", 20) ? oneOf(formData, "severity", SEVERITIES, "minor") : null,
  });
  if (error) fail(back, reason(error.message, t));
  refresh(uuid(formData, "athlete_id"));
  done(back, t.injury.saved);
}
