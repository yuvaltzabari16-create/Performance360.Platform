import { SUPABASE_KEY } from "@/lib/supabase/env";

/**
 * Bot protection for public forms. Three layers, all server-verified:
 *  1. Honeypot: a field humans never see; bots fill it.
 *  2. Time trap: a signed timestamp issued with the form; humans take a moment, bots submit instantly.
 *  3. Optional Cloudflare Turnstile challenge, enabled by setting TURNSTILE_SECRET_KEY.
 */

export const HONEYPOT_FIELD = "website";
export const TIMESTAMP_FIELD = "_form_ts";
export const TURNSTILE_FIELD = "cf-turnstile-response";

const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const minAgeMs = () => {
  const n = Number(process.env.BOT_GUARD_MIN_MS);
  return Number.isFinite(n) && n >= 0 ? n : 1200;
};
const secret = () => process.env.BOT_GUARD_SECRET || SUPABASE_KEY || "dev-only-secret";

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

/** Signed "issued at" token to embed in a form. */
export async function issueFormToken(now = Date.now()): Promise<string> {
  return `${now}.${await hmac(String(now))}`;
}

export type GuardResult = { ok: true } | { ok: false; reason: "honeypot" | "token" | "too_fast" | "expired" | "challenge" };

/** Checks the honeypot and the signed timestamp. */
export async function checkFormToken(fields: { honeypot?: string | null; token?: string | null }, now = Date.now()): Promise<GuardResult> {
  if (fields.honeypot) return { ok: false, reason: "honeypot" };
  const [ts, sig] = (fields.token ?? "").split(".");
  const issued = Number(ts);
  if (!sig || !Number.isFinite(issued) || (await hmac(ts)) !== sig) return { ok: false, reason: "token" };
  if (now - issued < minAgeMs()) return { ok: false, reason: "too_fast" };
  if (now - issued > MAX_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true };
}

export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

/** Verifies a Turnstile response with Cloudflare. Skipped (ok) when Turnstile is not configured. */
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/** Full server-side check of a submitted FormData. */
export async function verifyBotGuard(formData: FormData, ip?: string): Promise<GuardResult> {
  const honeypot = formData.get(HONEYPOT_FIELD);
  const token = formData.get(TIMESTAMP_FIELD);
  const base = await checkFormToken({ honeypot: typeof honeypot === "string" ? honeypot : null, token: typeof token === "string" ? token : null });
  if (!base.ok) return base;
  const challenge = formData.get(TURNSTILE_FIELD);
  if (!(await verifyTurnstile(typeof challenge === "string" ? challenge : null, ip))) return { ok: false, reason: "challenge" };
  return { ok: true };
}
