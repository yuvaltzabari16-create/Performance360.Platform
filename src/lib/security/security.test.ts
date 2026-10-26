import { describe, expect, it } from "vitest";
import { buildCsp, staticSecurityHeaders } from "./headers";
import { httpsUrl, isHttps, needsHttpsRedirect } from "./https";
import { ruleFor } from "./policy";
import { MemoryRateLimiter, clientIp } from "./rate-limit";

describe("content security policy", () => {
  const csp = buildCsp({ nonce: "abc", supabaseUrl: "https://proj.supabase.co", upgradeInsecure: true });
  it("only runs scripts that carry the nonce", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
  it("blocks plugins, framing and foreign form posts", () => {
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("allows only the video origins and the project backend", () => {
    expect(csp).toContain("frame-src https://www.youtube-nocookie.com");
    expect(csp).toContain("connect-src 'self' https://proj.supabase.co wss://proj.supabase.co");
  });
  it("sends HSTS only over https", () => {
    expect(staticSecurityHeaders({ https: true })["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(staticSecurityHeaders({ https: false })["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("https enforcement", () => {
  it("redirects plain http in production only", () => {
    expect(needsHttpsRedirect({ proto: "http", host: "app.example.com", nodeEnv: "production" })).toBe(true);
    expect(needsHttpsRedirect({ proto: "https", host: "app.example.com", nodeEnv: "production" })).toBe(false);
    expect(needsHttpsRedirect({ proto: "http", host: "localhost:3000", nodeEnv: "production" })).toBe(false);
    expect(needsHttpsRedirect({ proto: "http", host: "app.example.com", nodeEnv: "development" })).toBe(false);
  });
  it("builds the https url and detects https", () => {
    expect(httpsUrl(new URL("http://app.example.com:80/login?x=1")).toString()).toBe("https://app.example.com/login?x=1");
    expect(isHttps("https,http")).toBe(true);
    expect(isHttps(null)).toBe(false);
  });
});

describe("rate limiting", () => {
  const rule = { name: "t", windowMs: 1000, max: 3 };
  it("blocks after the limit and recovers in the next window", () => {
    const l = new MemoryRateLimiter();
    expect([1, 2, 3].map(() => l.hit("ip", rule, 0).allowed)).toEqual([true, true, true]);
    const blocked = l.hit("ip", rule, 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(l.hit("ip", rule, 1001).allowed).toBe(true);
  });
  it("counts each visitor separately and caps memory", () => {
    const l = new MemoryRateLimiter(5);
    expect(l.hit("a", rule, 0).remaining).toBe(2);
    expect(l.hit("b", rule, 0).remaining).toBe(2);
    for (let i = 0; i < 20; i++) l.hit(`k${i}`, rule, 0);
    expect(l.hit("c", rule, 0).allowed).toBe(true);
  });
  it("picks stricter rules for sign-in posts", () => {
    expect(ruleFor("POST", "/login").name).toBe("auth");
    expect(ruleFor("POST", "/training/x").name).toBe("write");
    expect(ruleFor("GET", "/dashboard").name).toBe("read");
    expect(ruleFor("POST", "/login").max).toBeLessThan(ruleFor("POST", "/training/x").max);
  });
  it("reads the caller ip from the proxy header", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
