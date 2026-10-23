/**
 * Request rate limiting (protects the server from floods and brute-force logins).
 *
 * Fixed-window counters kept in memory per server instance. That is a best-effort guard:
 * for a multi-instance deployment put the same interface in front of a shared store.
 */

export interface RateRule {
  /** Name used in the counter key, e.g. "auth". */
  name: string;
  windowMs: number;
  max: number;
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (for the Retry-After header). */
  retryAfterSec: number;
}

export class MemoryRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  /** Upper bound on tracked keys so a flood of distinct IPs cannot exhaust memory. */
  constructor(private readonly maxKeys = 20_000) {}

  /** Counts one request for `key` and says whether it is allowed. */
  hit(key: string, rule: RateRule, now = Date.now()): RateResult {
    const id = `${rule.name}:${key}`;
    let entry = this.hits.get(id);
    if (!entry || entry.resetAt <= now) {
      this.sweep(now);
      entry = { count: 0, resetAt: now + rule.windowMs };
      this.hits.set(id, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= rule.max,
      remaining: Math.max(0, rule.max - entry.count),
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  /** Drops expired counters, and everything if the table is still too large. */
  private sweep(now: number) {
    if (this.hits.size < this.maxKeys) return;
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    if (this.hits.size >= this.maxKeys) this.hits.clear();
  }
}

/** The caller's IP as reported by the hosting proxy (first x-forwarded-for entry). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}
