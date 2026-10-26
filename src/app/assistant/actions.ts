"use server";

import { getSession } from "@/lib/auth";
import { answer, cleanHistory, type ChatMessage } from "@/lib/assistant/engine";
import { assistantRole } from "@/lib/assistant/roles";

export type AskResult = { ok: true; text: string } | { ok: false; error: "signed_out" | "empty" };

/** One turn of the assistant chat. The role and language come from the account, never from the client. */
export async function askAssistant(history: ChatMessage[]): Promise<AskResult> {
  const { user, profile, org, locale } = await getSession();
  if (!user || !profile?.role) return { ok: false, error: "signed_out" };
  const clean = cleanHistory(history);
  const last = clean[clean.length - 1];
  if (!last) return { ok: false, error: "empty" };
  const role = assistantRole(profile.role, org?.org_role ?? null);
  return { ok: true, text: answer(last.content, role, locale === "he" ? "he" : "en").text };
}
