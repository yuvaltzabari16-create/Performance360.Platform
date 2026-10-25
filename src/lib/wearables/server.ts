import type { SupabaseClient } from "@supabase/supabase-js";
import { tokenKey, whoopConfig } from "./config";
import { decrypt, encrypt, sign, verify } from "./crypto";
import type { DailyMetrics, WearableProvider } from "./types";
import { exchangeCode, fetchWhoopDays, refreshTokens } from "./whoop";

/** Server-side wearable operations: token handling, connect, sync and saving days. */

const STATE_MAX_AGE_S = 600;
export const STATE_COOKIE = "p360_wearable_state";

interface StatePayload { u: string; p: WearableProvider; n: string; exp: number }

/** Signed OAuth state: ties the callback to this user, provider and a one-time value kept in a cookie. */
export function makeState(userId: string, provider: WearableProvider): string | null {
  const key = tokenKey();
  if (!key) return null;
  return sign({ u: userId, p: provider, n: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) + STATE_MAX_AGE_S } satisfies StatePayload, key);
}

export function readState(state: string, userId: string, provider: WearableProvider): boolean {
  const key = tokenKey();
  const p = key ? verify<StatePayload>(state, key) : null;
  return Boolean(p && p.u === userId && p.p === provider && p.exp > Date.now() / 1000);
}

export const STATE_COOKIE_MAX_AGE = STATE_MAX_AGE_S;

/** Chunks days into the 400-row batches the database accepts and saves them. */
export async function saveDays(supabase: SupabaseClient, provider: WearableProvider, rows: DailyMetrics[], error: string | null = null): Promise<number> {
  let saved = 0;
  const chunks = rows.length ? Array.from({ length: Math.ceil(rows.length / 400) }, (_, i) => rows.slice(i * 400, (i + 1) * 400)) : [[]];
  for (let i = 0; i < chunks.length; i++) {
    const { data, error: e } = await supabase.rpc("wearable_save_days", { p_provider: provider, p_rows: chunks[i], p_error: i === chunks.length - 1 ? error : null });
    if (e) throw new Error(e.message);
    saved += Number(data ?? 0);
  }
  return saved;
}

/** Completes the WHOOP authorization: swaps the code for tokens, stores them encrypted and runs a first sync. */
export async function connectWhoop(supabase: SupabaseClient, code: string): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  const cfg = whoopConfig();
  const key = tokenKey();
  if (!cfg || !key) return { ok: false, error: "not_configured" };
  try {
    const { tokens, scope } = await exchangeCode(cfg, code);
    const { error } = await supabase.rpc("wearable_connect", {
      p_provider: "whoop", p_source: "api", p_access: encrypt(tokens.access, key),
      p_refresh: tokens.refresh ? encrypt(tokens.refresh, key) : null, p_expires: tokens.expiresAt?.toISOString() ?? null, p_scopes: scope, p_external: null,
    });
    if (error) return { ok: false, error: "save_failed" };
  } catch {
    return { ok: false, error: "exchange_failed" };
  }
  const synced = await syncWhoop(supabase);
  return synced.ok ? { ok: true, days: synced.days } : { ok: false, error: synced.error };
}

interface TokenRow { access_cipher: string | null; refresh_cipher: string | null; expires_at: string | null }

/**
 * Shared sync step: refreshes the access token when it is close to expiry, pulls the last 30 days and hands them to
 * `save`. Used for a person pressing "Sync now" and for the scheduled job, so both behave the same.
 */
async function pullWhoop(
  row: TokenRow,
  io: { saveTokens: (access: string, refresh: string | null, expires: string | null) => Promise<void>; save: (days: DailyMetrics[], error: string | null) => Promise<number> },
): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  const cfg = whoopConfig();
  const key = tokenKey();
  if (!cfg || !key) return { ok: false, error: "not_configured" };
  if (!row.access_cipher) return { ok: false, error: "not_connected" };
  let access = decrypt(row.access_cipher, key);
  const refresh = row.refresh_cipher ? decrypt(row.refresh_cipher, key) : null;
  if (!access) return { ok: false, error: "token_unreadable" };
  try {
    const expiring = row.expires_at ? new Date(row.expires_at).getTime() < Date.now() + 60_000 : false;
    if (expiring && refresh) {
      const r = await refreshTokens(cfg, refresh);
      access = r.tokens.access;
      await io.saveTokens(encrypt(r.tokens.access, key), r.tokens.refresh ? encrypt(r.tokens.refresh, key) : null, r.tokens.expiresAt?.toISOString() ?? null);
    }
    const days = await fetchWhoopDays(cfg, access, 30);
    return { ok: true, days: await io.save(days, null) };
  } catch (e) {
    const code = e instanceof Error ? e.message : "sync_failed";
    await io.save([], code).catch(() => undefined);
    return { ok: false, error: code };
  }
}

/** Pulls the last 30 days from WHOOP for the signed-in athlete ("Sync now" and right after connecting). */
export async function syncWhoop(supabase: SupabaseClient): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  const { data } = await supabase.rpc("wearable_tokens_get", { p_provider: "whoop" });
  const row = (data as TokenRow[] | null)?.[0];
  if (!row?.access_cipher) return { ok: false, error: "not_connected" };
  return pullWhoop(row, {
    saveTokens: async (access, refresh, expires) => { await supabase.rpc("wearable_tokens_update", { p_provider: "whoop", p_access: access, p_refresh: refresh, p_expires: expires }); },
    save: (days, error) => saveDays(supabase, "whoop", days, error),
  });
}

/** Scheduled job: syncs every API-linked WHOOP connection that has not synced for `olderThanHours`. Uses the service-role client. */
export async function syncAllWhoop(admin: SupabaseClient, olderThanHours = 5, limit = 50): Promise<{ due: number; synced: number; failed: number }> {
  const { data } = await admin.rpc("wearable_cron_due", { p_provider: "whoop", p_older_than: `${olderThanHours} hours`, p_limit: limit });
  const due = (data ?? []) as (TokenRow & { athlete_id: string })[];
  let synced = 0;
  let failed = 0;
  for (const row of due) {
    const result = await pullWhoop(row, {
      saveTokens: async (access, refresh, expires) => { await admin.rpc("wearable_cron_tokens_update", { p_athlete: row.athlete_id, p_provider: "whoop", p_access: access, p_refresh: refresh, p_expires: expires }); },
      save: async (days, error) => {
        const { data: n, error: e } = await admin.rpc("wearable_save_days_for", { p_athlete: row.athlete_id, p_provider: "whoop", p_rows: days.slice(0, 400), p_error: error });
        if (e) throw new Error(e.message);
        return Number(n ?? 0);
      },
    });
    if (result.ok) synced++; else failed++;
  }
  return { due: due.length, synced, failed };
}
