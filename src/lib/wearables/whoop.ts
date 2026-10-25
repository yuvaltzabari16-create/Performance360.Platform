import { MOCK, WHOOP_SCOPES, type WhoopConfig } from "./config";
import type { DailyMetrics, TokenSet } from "./types";

/**
 * WHOOP developer API (v2) client: OAuth 2.0 authorization-code flow and the recovery, sleep and cycle
 * collections. Written from WHOOP's public documentation; the endpoints and field names should be checked
 * against developer.whoop.com when real credentials are first used. All network calls take an injectable
 * `fetch` so they are tested against fixtures and against the built-in mock provider.
 */

type Fetch = typeof fetch;

export function authorizeUrl(cfg: WhoopConfig, state: string): string {
  const q = new URLSearchParams({ response_type: "code", client_id: cfg.clientId, redirect_uri: cfg.redirectUri, scope: WHOOP_SCOPES, state });
  return `${cfg.authUrl}?${q}`;
}

interface TokenResponse { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }

async function tokenRequest(cfg: WhoopConfig, body: Record<string, string>, f: Fetch): Promise<{ tokens: TokenSet; scope: string | null }> {
  const res = await f(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...body }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`token_${res.status}`);
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) throw new Error("token_missing");
  return {
    tokens: { access: json.access_token, refresh: json.refresh_token ?? null, expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null },
    scope: json.scope ?? null,
  };
}

export const exchangeCode = (cfg: WhoopConfig, code: string, f: Fetch = fetch) =>
  tokenRequest(cfg, { grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri }, f);

export const refreshTokens = (cfg: WhoopConfig, refresh: string, f: Fetch = fetch) =>
  tokenRequest(cfg, { grant_type: "refresh_token", refresh_token: refresh, scope: "offline" }, f);

// ----- data -----------------------------------------------------------------------------------------

interface Page<T> { records?: T[]; next_token?: string | null }

async function collect<T>(cfg: WhoopConfig, access: string, path: string, sinceIso: string, f: Fetch): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = null;
  for (let page = 0; page < 12; page++) {
    const q = new URLSearchParams({ limit: "25", start: sinceIso });
    if (next) q.set("nextToken", next);
    const res = await f(`${cfg.apiBase}${path}?${q}`, { headers: { Authorization: `Bearer ${access}`, Accept: "application/json" }, cache: "no-store" });
    if (res.status === 401) throw new Error("unauthorized");
    if (res.status === 429) throw new Error("rate_limited");
    if (!res.ok) throw new Error(`api_${res.status}`);
    const json = (await res.json()) as Page<T>;
    out.push(...(json.records ?? []));
    next = json.next_token ?? null;
    if (!next) break;
  }
  return out;
}

interface Scored<S> { score_state?: string; score?: S | null; timezone_offset?: string }
export interface WhoopRecovery extends Scored<{ recovery_score?: number; resting_heart_rate?: number; hrv_rmssd_milli?: number; spo2_percentage?: number; skin_temp_celsius?: number }> { created_at: string }
export interface WhoopSleep extends Scored<{ stage_summary?: { total_light_sleep_time_milli?: number; total_slow_wave_sleep_time_milli?: number; total_rem_sleep_time_milli?: number }; sleep_performance_percentage?: number }> { start: string; end: string; nap?: boolean }
export interface WhoopCycle extends Scored<{ strain?: number; average_heart_rate?: number; max_heart_rate?: number }> { start: string }

/** Calendar day (YYYY-MM-DD) of an instant in the athlete's own time zone ("+02:00" style offset). */
export function localDay(iso: string, offset?: string): string {
  const m = offset?.match(/^([+-])(\d{2}):?(\d{2})$/);
  const minutes = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString().slice(0, 10);
}

const scored = <T extends Scored<unknown>>(r: T) => r.score_state === "SCORED" && r.score != null;
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Merges the three collections into one row per day. A cycle starts when the athlete wakes: the cycle's start
 * day, the recovery computed that morning and the sleep that ended that morning all share the same day.
 */
export function mapWhoop(recovery: WhoopRecovery[], sleep: WhoopSleep[], cycles: WhoopCycle[]): DailyMetrics[] {
  const days = new Map<string, DailyMetrics>();
  const row = (day: string) => days.get(day) ?? (days.set(day, { day }), days.get(day)!);
  for (const r of recovery.filter(scored)) {
    const s = r.score!;
    Object.assign(row(localDay(r.created_at, r.timezone_offset)), {
      recovery_score: s.recovery_score ?? null, resting_hr: s.resting_heart_rate ?? null,
      hrv_ms: s.hrv_rmssd_milli != null ? round(s.hrv_rmssd_milli) : null, spo2: s.spo2_percentage ?? null, skin_temp_c: s.skin_temp_celsius ?? null,
    });
  }
  for (const s of sleep.filter((x) => scored(x) && !x.nap)) {
    const st = s.score!.stage_summary;
    const asleepMs = (st?.total_light_sleep_time_milli ?? 0) + (st?.total_slow_wave_sleep_time_milli ?? 0) + (st?.total_rem_sleep_time_milli ?? 0);
    const d = row(localDay(s.end, s.timezone_offset));
    d.sleep_hours = round((d.sleep_hours ?? 0) + asleepMs / 3_600_000, 2);
    if (s.score!.sleep_performance_percentage != null) d.sleep_performance = s.score!.sleep_performance_percentage;
  }
  for (const c of cycles.filter(scored)) {
    const s = c.score!;
    Object.assign(row(localDay(c.start, c.timezone_offset)), {
      strain: s.strain != null ? round(s.strain) : null, avg_hr: s.average_heart_rate ?? null, max_hr: s.max_heart_rate ?? null,
    });
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Last `days` days of recovery, sleep and cycles for one athlete, as daily rows. */
export async function fetchWhoopDays(cfg: WhoopConfig, access: string, days = 30, f: Fetch = fetch): Promise<DailyMetrics[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [recovery, sleep, cycles] = await Promise.all([
    collect<WhoopRecovery>(cfg, access, "/recovery", since, f),
    collect<WhoopSleep>(cfg, access, "/activity/sleep", since, f),
    collect<WhoopCycle>(cfg, access, "/cycle", since, f),
  ]);
  return mapWhoop(recovery, sleep, cycles);
}

export { MOCK };
