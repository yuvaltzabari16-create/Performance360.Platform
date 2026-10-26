import { describe, expect, it } from "vitest";
import type { WhoopConfig } from "./config";
import { authorizeUrl, exchangeCode, fetchWhoopDays, localDay, mapWhoop, refreshTokens } from "./whoop";

const cfg: WhoopConfig = { clientId: "id", clientSecret: "secret", authUrl: "https://w.test/auth", tokenUrl: "https://w.test/token", apiBase: "https://w.test/v2", redirectUri: "https://app.test/cb" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("localDay", () => {
  it("applies the athlete's offset", () => {
    expect(localDay("2026-10-20T22:30:00Z", "+02:00")).toBe("2026-10-21");
    expect(localDay("2026-10-20T02:30:00Z", "-05:00")).toBe("2026-10-19");
    expect(localDay("2026-10-20T10:00:00Z")).toBe("2026-10-20");
  });
});

describe("mapWhoop", () => {
  const recovery = [{ created_at: "2026-10-20T05:10:00Z", timezone_offset: "+02:00", score_state: "SCORED", score: { recovery_score: 72, resting_heart_rate: 51, hrv_rmssd_milli: 64.26, spo2_percentage: 96.4, skin_temp_celsius: 33.2 } },
    { created_at: "2026-10-21T05:10:00Z", timezone_offset: "+02:00", score_state: "PENDING_SCORE" }];
  const sleep = [
    { start: "2026-10-19T21:00:00Z", end: "2026-10-20T04:30:00Z", timezone_offset: "+02:00", score_state: "SCORED", nap: false, score: { stage_summary: { total_light_sleep_time_milli: 3 * 3.6e6, total_slow_wave_sleep_time_milli: 1.5 * 3.6e6, total_rem_sleep_time_milli: 2 * 3.6e6 }, sleep_performance_percentage: 88 } },
    { start: "2026-10-20T11:00:00Z", end: "2026-10-20T11:40:00Z", timezone_offset: "+02:00", score_state: "SCORED", nap: true, score: { stage_summary: { total_light_sleep_time_milli: 0.5 * 3.6e6 } } },
  ];
  const cycles = [{ start: "2026-10-20T04:30:00Z", timezone_offset: "+02:00", score_state: "SCORED", score: { strain: 12.34, average_heart_rate: 71, max_heart_rate: 168 } }];

  it("merges recovery, sleep and cycle into one row per day", () => {
    expect(mapWhoop(recovery, sleep, cycles)).toEqual([
      { day: "2026-10-20", recovery_score: 72, resting_hr: 51, hrv_ms: 64.3, spo2: 96.4, skin_temp_c: 33.2, sleep_hours: 6.5, sleep_performance: 88, strain: 12.3, avg_hr: 71, max_hr: 168 },
    ]);
  });
  it("ignores unscored records and naps", () => {
    const rows = mapWhoop(recovery, sleep, cycles);
    expect(rows).toHaveLength(1);
    expect(rows[0].sleep_hours).toBe(6.5); // the 30-minute nap is not counted
  });
  it("returns nothing for no records", () => {
    expect(mapWhoop([], [], [])).toEqual([]);
  });
});

describe("OAuth and API calls", () => {
  it("builds the authorization URL with scope and state", () => {
    const u = new URL(authorizeUrl(cfg, "state-123"));
    expect(u.origin + u.pathname).toBe("https://w.test/auth");
    expect(u.searchParams.get("state")).toBe("state-123");
    expect(u.searchParams.get("scope")).toContain("offline");
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.test/cb");
  });
  it("exchanges a code and refreshes tokens", async () => {
    const seen: string[] = [];
    const f = (async (_url: string, init?: RequestInit) => { seen.push(String(init?.body)); return json({ access_token: "a1", refresh_token: "r1", expires_in: 3600, scope: "offline" }); }) as unknown as typeof fetch;
    const t = await exchangeCode(cfg, "code-1", f);
    expect(t.tokens.access).toBe("a1");
    expect(t.tokens.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    await refreshTokens(cfg, "r1", f);
    expect(seen[0]).toContain("grant_type=authorization_code");
    expect(seen[1]).toContain("grant_type=refresh_token");
  });
  it("raises clear errors", async () => {
    await expect(exchangeCode(cfg, "x", (async () => json({}, 400)) as unknown as typeof fetch)).rejects.toThrow("token_400");
    await expect(fetchWhoopDays(cfg, "t", 7, (async () => json({}, 401)) as unknown as typeof fetch)).rejects.toThrow("unauthorized");
    await expect(fetchWhoopDays(cfg, "t", 7, (async () => json({}, 429)) as unknown as typeof fetch)).rejects.toThrow("rate_limited");
  });
  it("follows pagination", async () => {
    let calls = 0;
    const f = (async (url: string) => {
      calls++;
      if (!url.includes("/recovery")) return json({ records: [] });
      return url.includes("nextToken=p2") ? json({ records: [{ created_at: "2026-10-21T05:00:00Z", score_state: "SCORED", score: { recovery_score: 50 } }] })
        : json({ records: [{ created_at: "2026-10-20T05:00:00Z", score_state: "SCORED", score: { recovery_score: 60 } }], next_token: "p2" });
    }) as unknown as typeof fetch;
    const rows = await fetchWhoopDays(cfg, "t", 7, f);
    expect(rows.map((r) => r.recovery_score)).toEqual([60, 50]);
    expect(calls).toBe(4); // two recovery pages + sleep + cycle
  });
});
