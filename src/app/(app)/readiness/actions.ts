"use server";

import { revalidatePath } from "next/cache";
import { requireAthlete } from "@/lib/auth";
import { bool, done, fail, int, num, str } from "@/lib/forms";
import { todayFor } from "@/lib/dates.server";

const scale = (fd: FormData, key: string) => {
  const v = int(fd, key);
  return v != null && v >= 1 && v <= 5 ? v : null;
};

export async function submitReadiness(formData: FormData) {
  const { supabase, t } = await requireAthlete();
  // Creates the athlete's own record on first use (no-op if it exists).
  const { data: athleteId, error: ensureError } = await supabase.rpc("ensure_my_athlete_record");
  if (ensureError || !athleteId) fail("/readiness", t.common.error);
  const sleep = num(formData, "sleep_hours");
  const entryDate = str(formData, "entry_date", 10) ?? (await todayFor());
  const { error } = await supabase.from("readiness_entries").upsert(
    {
      athlete_id: athleteId,
      entry_date: entryDate,
      sleep_hours: sleep != null && sleep >= 0 && sleep <= 24 ? sleep : null,
      sleep_quality: scale(formData, "sleep_quality"),
      fatigue: scale(formData, "fatigue"),
      soreness: scale(formData, "soreness"),
      stress: scale(formData, "stress"),
      mood: scale(formData, "mood"),
      motivation: scale(formData, "motivation"),
      pain_reported: bool(formData, "pain_reported"),
      pain_notes: str(formData, "pain_notes", 1000),
      notes: str(formData, "notes", 2000),
    },
    { onConflict: "athlete_id,entry_date" },
  );
  if (error) fail("/readiness", error.message);
  revalidatePath("/readiness");
  revalidatePath("/dashboard");
  done("/readiness", t.readiness.submitted);
}
