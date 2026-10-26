import { describe, expect, it } from "vitest";
import { checkFormToken, issueFormToken } from "./bot-guard";
import { containsPattern, escapeLike, sanitizeSearchTerm } from "./query";
import { safeHttpUrl, safeInternalPath } from "./url";

describe("search input sanitising (filter injection)", () => {
  it("strips PostgREST syntax and wildcards", () => {
    expect(sanitizeSearchTerm("x),email.ilike.%")).toBe("x email.ilike.");
    expect(sanitizeSearchTerm("a,b(c)*d%e_f\\g")).toBe("a b c d e f g");
    expect(sanitizeSearchTerm("'; drop table athletes;--")).toBe("drop table athletes --");
  });
  it("keeps names in any language", () => {
    expect(sanitizeSearchTerm("  דנה  כהן ")).toBe("דנה כהן");
    expect(sanitizeSearchTerm("O'Neil")).toBe("O Neil");
  });
  it("limits length", () => {
    expect(sanitizeSearchTerm("a".repeat(500), 80)).toHaveLength(80);
    expect(sanitizeSearchTerm(null)).toBe("");
  });
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(containsPattern("abc")).toBe("%abc%");
  });
});

describe("url validation (XSS)", () => {
  it("accepts only http(s) links", () => {
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
  });
  it("accepts only internal paths", () => {
    expect(safeInternalPath("/athletes/1")).toBe("/athletes/1");
    expect(safeInternalPath("//evil.com")).toBeNull();
    expect(safeInternalPath("https://evil.com")).toBeNull();
    expect(safeInternalPath("/\\evil.com")).toBeNull();
  });
});

describe("bot guard token", () => {
  it("accepts a token that aged a moment and rejects bots", async () => {
    const t0 = 1_000_000;
    const token = await issueFormToken(t0);
    process.env.BOT_GUARD_MIN_MS = "1000";
    expect((await checkFormToken({ token }, t0 + 1500)).ok).toBe(true);
    expect(await checkFormToken({ token }, t0 + 200)).toEqual({ ok: false, reason: "too_fast" });
    expect(await checkFormToken({ token, honeypot: "http://spam" }, t0 + 5000)).toEqual({ ok: false, reason: "honeypot" });
    expect(await checkFormToken({ token }, t0 + 3 * 60 * 60 * 1000)).toEqual({ ok: false, reason: "expired" });
  });
  it("rejects forged or missing tokens", async () => {
    expect(await checkFormToken({ token: "123.deadbeef" }, 10_000_000)).toEqual({ ok: false, reason: "token" });
    expect(await checkFormToken({ token: null }, 10_000_000)).toEqual({ ok: false, reason: "token" });
  });
});
