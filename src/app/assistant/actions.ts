"use server";

import { getSession } from "@/lib/auth";
import { answer, cleanHistory, type ChatMessage } from "@/lib/assistant/engine";
import { detectIntent, personalAnswer } from "@/lib/assistant/personal";
import { assistantRole } from "@/lib/assistant/roles";
import { loadPersonalData } from "./data";

export type AskResult = { ok: true; text: string } | { ok: false; error: "signed_out" | "empty" };

/**
 * One turn of the assistant chat. The role and language come from the account, never from the client.
 * Questions about the person's own numbers (or, for staff, their athletes') are answered from the database under
 * that person's permissions; everything else comes from the written knowledge base.
 */
export async function askAssistant(history: ChatMessage[]): Promise<AskResult> {
  const { supabase, user, profile, org, locale } = await getSession();
  if (!user || !profile?.role) return { ok: false, error: "signed_out" };
  const clean = cleanHistory(history);
  const last = clean[clean.length - 1];
  if (!last) return { ok: false, error: "empty" };
  const lang = locale === "he" ? "he" : "en";
  const role = assistantRole(profile.role, org?.org_role ?? null);

  const isAthlete = profile.role === "athlete";
  const intent = detectIntent(last.content, !isAthlete);
  if (intent) {
    let athleteId: string | null = null;
    if (isAthlete) {
      const { data } = await supabase.from("athletes").select("id").eq("user_id", user.id).maybeSingle();
      athleteId = (data?.id as string | undefined) ?? null;
    }
    if (!isAthlete || athleteId) {
      const data = await loadPersonalData(supabase, intent, athleteId);
      return { ok: true, text: personalAnswer(intent, !isAthlete, data, lang) };
    }
  }
  return { ok: true, text: answer(last.content, role, lang).text };
}
