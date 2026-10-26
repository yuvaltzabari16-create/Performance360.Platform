import type { RateRule } from "./rate-limit";

/**
 * Which rate limit applies to a request. Authentication endpoints are the strictest because
 * they are the target of password guessing and sign-up spam.
 */

const MINUTE = 60_000;
const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Paths whose POSTs are authentication attempts. */
const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/join", "/settings"];

export function ruleFor(method: string, pathname: string): RateRule {
  const isAuth = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (method === "POST" && isAuth) return { name: "auth", windowMs: MINUTE, max: envInt("RATE_LIMIT_AUTH_MAX", 20) };
  if (method !== "GET" && method !== "HEAD") return { name: "write", windowMs: MINUTE, max: envInt("RATE_LIMIT_WRITE_MAX", 180) };
  return { name: "read", windowMs: MINUTE, max: envInt("RATE_LIMIT_READ_MAX", 600) };
}

/** Set RATE_LIMIT_DISABLED=1 for automated test runs that log in many times from one IP. */
export const rateLimitDisabled = () => process.env.RATE_LIMIT_DISABLED === "1";
