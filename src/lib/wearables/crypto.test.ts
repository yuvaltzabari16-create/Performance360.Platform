import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt, parseKey, sign, verify } from "./crypto";

const key = randomBytes(32);

describe("token encryption", () => {
  it("round-trips and never repeats the ciphertext", () => {
    const a = encrypt("secret-token", key);
    expect(a).not.toContain("secret-token");
    expect(decrypt(a, key)).toBe("secret-token");
    expect(encrypt("secret-token", key)).not.toBe(a);
  });
  it("rejects the wrong key, tampering and junk", () => {
    const a = encrypt("secret-token", key);
    expect(decrypt(a, randomBytes(32))).toBeNull();
    expect(decrypt(a.slice(0, -2) + "xx", key)).toBeNull();
    expect(decrypt("not-ciphertext", key)).toBeNull();
  });
  it("accepts only a 32-byte base64 key", () => {
    expect(parseKey(randomBytes(32).toString("base64"))).toHaveLength(32);
    expect(parseKey(randomBytes(16).toString("base64"))).toBeNull();
    expect(parseKey(undefined)).toBeNull();
  });
});

describe("signed state", () => {
  it("verifies its own payload and rejects changes", () => {
    const t = sign({ u: "user-1", exp: 123 }, key);
    expect(verify<{ u: string }>(t, key)).toEqual({ u: "user-1", exp: 123 });
    const [body, mac] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "user-2", exp: 123 })).toString("base64url");
    expect(verify(`${forged}.${mac}`, key)).toBeNull();
    expect(verify(`${body}.AAAA`, key)).toBeNull();
    expect(verify(t, randomBytes(32))).toBeNull();
  });
});
