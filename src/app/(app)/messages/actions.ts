"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { fail, isUuid, str } from "@/lib/forms";

/**
 * Sends a message in a coach–athlete thread. The database policy checks that
 * the sender is one of the two parties and that the connection is active.
 */
export async function sendMessage(formData: FormData) {
  const { supabase, user, profile, t } = await requireProfile();
  const athleteId = str(formData, "athlete_id", 64);
  const coachId = str(formData, "coach_id", 64);
  const body = str(formData, "body", 4000);
  const back = profile.role === "athlete" ? `/messages?coach=${coachId}` : `/messages?athlete=${athleteId}`;
  if (!isUuid(athleteId) || !isUuid(coachId)) fail("/messages", t.common.error);
  if (!body) fail(back, t.common.required);
  const { error } = await supabase.from("messages").insert({ athlete_id: athleteId, coach_id: coachId, sender_id: user.id, body });
  if (error) fail(back, t.common.notAllowed);
  revalidatePath("/messages");
  redirect(back);
}
