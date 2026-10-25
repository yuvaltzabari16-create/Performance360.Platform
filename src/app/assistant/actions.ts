"use server";

import { getSession } from "@/lib/auth";
import { assistantSystemPrompt, chatReply, cleanHistory, type ChatMessage } from "@/lib/ai/assistant";
import { assistantRole } from "@/lib/ai/assistant-roles";

export type AskResult = { ok: true; text: string } | { ok: false; error: "signed_out" | "not_configured" | "rate_limited" | "failed" | "refused" | "empty" };

/** One turn of the assistant chat. The role and language come from the account, never from the client. */
export async function askAssistant(history: ChatMessage[]): Promise<AskResult> {
  const { user, profile, org, locale } = await getSession();
  if (!user || !profile?.role) return { ok: false, error: "signed_out" };
  const clean = cleanHistory(history);
  const orgRole = org?.org_role ?? null;
  const system = assistantSystemPrompt(profile.role, orgRole, locale === "he" ? "he" : "en");
  return chatReply(system, clean, user.id, assistantRole(profile.role, orgRole));
}
