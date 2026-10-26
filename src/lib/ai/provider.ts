import { MemoryRateLimiter } from "@/lib/security/rate-limit";
import { SYSTEM_PROMPT, userMessage, type LibraryEntry } from "./prompt";
import { WORKOUT_TOOL } from "./workout";

/**
 * Calls the language model. Uses the Anthropic Messages API with a forced tool call so the answer
 * is structured JSON. Configure with ANTHROPIC_API_KEY (and optionally AI_MODEL). For automated
 * tests only, AI_PROVIDER=mock returns a fixed workout without calling any service.
 */

export type AiFailure = "not_configured" | "rate_limited" | "failed" | "refused";
export type AiResult = { ok: true; raw: unknown } | { ok: false; error: AiFailure };

const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_REQUEST_CHARS = 800;
/** A few requests per hour per person keeps cost and abuse in check. */
const limiter = new MemoryRateLimiter();
const RULE = { name: "ai", windowMs: 60 * 60 * 1000, max: Number(process.env.AI_REQUESTS_PER_HOUR) || 20 };

const MOCK = {
  title: "Lower body power (mock)",
  blocks: [
    { section: "warmup", exercises: [{ name: "Cat / Cow", durationSeconds: 60 }, { name: "Sidelying Open Book", sets: 2, reps: "6" }] },
    { section: "plyometrics", exercises: [{ name: "Double Leg Pogos", sets: 3, reps: "15", restSeconds: 30, rpe: 4 }, { name: "Box Jumps", sets: 3, reps: "4", restSeconds: 90, rpe: 6 }] },
    { section: "strength", exercises: [{ name: "Barbell Front Squat", sets: 3, reps: "4", restSeconds: 90, rpe: 8 }, { name: "An Invented Exercise", sets: 3, reps: "8" }] },
  ],
};

/** Requests a workout for `request`. `userId` scopes the rate limit. */
export async function requestWorkout(request: string, library: LibraryEntry[], userId: string): Promise<AiResult> {
  const text = request.trim().slice(0, MAX_REQUEST_CHARS);
  if (!text) return { ok: false, error: "failed" };
  if (!limiter.hit(userId, RULE).allowed) return { ok: false, error: "rate_limited" };

  if (process.env.AI_PROVIDER === "mock") return { ok: true, raw: MOCK };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || DEFAULT_MODEL,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        tools: [WORKOUT_TOOL],
        tool_choice: { type: "tool", name: WORKOUT_TOOL.name },
        messages: [{ role: "user", content: userMessage(text, library) }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { ok: false, error: "failed" };
    const data = (await res.json()) as { stop_reason?: string; content?: { type: string; input?: unknown }[] };
    if (data.stop_reason === "refusal") return { ok: false, error: "refused" };
    const tool = data.content?.find((c) => c.type === "tool_use");
    return tool?.input ? { ok: true, raw: tool.input } : { ok: false, error: "failed" };
  } catch {
    return { ok: false, error: "failed" };
  }
}

