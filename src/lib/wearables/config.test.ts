import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// MOCK is read when the module loads, so each case sets the environment first and imports afresh.
async function config(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  return (await import("./config")).whoopConfig();
}
const KEYS = { WEARABLES_MOCK: undefined, WEARABLE_TOKEN_KEY: Buffer.alloc(32, 1).toString("base64"), WHOOP_CLIENT_ID: "id", WHOOP_CLIENT_SECRET: "secret", WHOOP_LIVE: undefined };

describe("live WHOOP switch", () => {
  const saved = { ...process.env };
  beforeEach(() => vi.resetModules());
  afterEach(() => { process.env = { ...saved }; });

  it("stays off with valid keys until WHOOP_LIVE=1 is set", async () => {
    expect(await config(KEYS)).toBeNull();
    expect(await config({ ...KEYS, WHOOP_LIVE: "0" })).toBeNull();
  });
  it("turns on with WHOOP_LIVE=1 and both keys", async () => {
    expect((await config({ ...KEYS, WHOOP_LIVE: "1" }))?.clientId).toBe("id");
    expect(await config({ ...KEYS, WHOOP_LIVE: "1", WHOOP_CLIENT_SECRET: "" })).toBeNull();
  });
  it("still needs the token key", async () => {
    expect(await config({ ...KEYS, WHOOP_LIVE: "1", WEARABLE_TOKEN_KEY: undefined })).toBeNull();
  });
  it("leaves the built-in test provider alone", async () => {
    expect((await config({ ...KEYS, WEARABLES_MOCK: "1", WHOOP_LIVE: undefined }))?.clientId).toBe("mock-client");
  });
});
