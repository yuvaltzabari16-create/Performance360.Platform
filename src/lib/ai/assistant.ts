import { MemoryRateLimiter } from "@/lib/security/rate-limit";
import type { OrgRole, UserRole } from "@/lib/types";
import { ROLE_BRIEF, assistantRole, sectionGuide, type AssistantRole } from "./assistant-roles";

/**
 * The chat assistant: a help and coaching-knowledge companion for every role. It never receives the user's
 * data (only what they type), cannot change anything in the app, and does not diagnose or clear anyone.
 * Uses the Anthropic Messages API (ANTHROPIC_API_KEY, AI_MODEL). AI_PROVIDER=mock returns a fixed reply (tests).
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatFailure = "not_configured" | "rate_limited" | "failed" | "refused" | "empty";
export type ChatResult = { ok: true; text: string } | { ok: false; error: ChatFailure };

const DEFAULT_MODEL = "claude-sonnet-5-5";
export const MAX_MESSAGE_CHARS = 1000;
export const MAX_HISTORY = 10;
const limiter = new MemoryRateLimiter();
const RULE = { name: "chat", windowMs: 60 * 60 * 1000, max: Number(process.env.AI_CHAT_REQUESTS_PER_HOUR) || 40 };

/** Keeps the last turns, trims them, drops anything malformed, and makes sure it starts and ends with the user. */
export function cleanHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const msgs = input
    .filter((m): m is ChatMessage => Boolean(m) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_HISTORY);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  // The Messages API needs alternating turns: merge consecutive messages from the same side.
  const merged: ChatMessage[] = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n${m.content}`.slice(0, MAX_MESSAGE_CHARS * 2);
    else merged.push({ ...m });
  }
  return merged[merged.length - 1]?.role === "user" ? merged : [];
}

/** System prompt for one login: the product, what this role can and cannot do, and the safety rules. */
export function assistantSystemPrompt(role: UserRole, orgRole: OrgRole | null, language: "en" | "he"): string {
  const ar: AssistantRole = assistantRole(role, orgRole);
  const brief = ROLE_BRIEF[ar];
  return [
    "You are the Performance360 assistant, inside an app where athletes, coaches, medical and performance staff plan training, track tests, wellness, injuries, GPS and wearable data, and message each other.",
    `The person you are talking to is a ${brief.title}.`,
    `Their role: ${brief.does.join("; ")}.`,
    `Their role cannot: ${brief.cannot.join("; ")}.`,
    "Sections they can open:",
    sectionGuide(role, orgRole),
    "",
    "Help with: how to use the app and where to find things, athletic training knowledge (periodization, load and recovery concepts, RPE, testing, GPS and wearable metrics in general terms, return-to-play principles at an educational level), and drafting messages, notes or plans for the person to review.",
    "Rules:",
    "- You do not see this person's athletes, figures or records. If asked about them, say so and point to the section of the app where they can look.",
    "- Never diagnose, prescribe treatment or say an athlete is safe to return. For pain, injury or health questions give general information and say a qualified professional decides. In an emergency tell them to contact emergency services.",
    "- Do not ask for names, health details or other personal data, and remind the person not to type them if they do.",
    "- Only describe features that exist for this role. If something is not available to them, say who can do it. Never claim you changed anything in the app.",
    "- Be concise and practical: short paragraphs or a few bullets, under about 180 words unless asked for more.",
    `- Reply in ${language === "he" ? "Hebrew" : "English"} unless the person writes in another language.`,
  ].join("\n");
}

/** Sends the conversation to the model. `userId` scopes the rate limit. */
export async function chatReply(system: string, history: ChatMessage[], userId: string, roleKey: AssistantRole): Promise<ChatResult> {
  if (history.length === 0) return { ok: false, error: "empty" };
  if (!limiter.hit(userId, RULE).allowed) return { ok: false, error: "rate_limited" };
  if (process.env.AI_PROVIDER === "mock") {
    return { ok: true, text: `[mock assistant · ${roleKey}] ${history[history.length - 1].content.slice(0, 120)}` };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.AI_MODEL || DEFAULT_MODEL, max_tokens: 700, system, messages: history }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return { ok: false, error: "failed" };
    const data = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
    if (data.stop_reason === "refusal") return { ok: false, error: "refused" };
    const text = data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    return text ? { ok: true, text } : { ok: false, error: "failed" };
  } catch {
    return { ok: false, error: "failed" };
  }
}
