import { describe, expect, it } from "vitest";
import { isAffiliateUrl } from "./affiliate";

describe("affiliate link detection", () => {
  it("flags configured hosts and subdomains", () => {
    expect(isAffiliateUrl("https://shop.example.com/p/1", ["example.com"])).toBe(true);
    expect(isAffiliateUrl("https://example.com/p/1", ["example.com"])).toBe(true);
    expect(isAffiliateUrl("https://notexample.com/p/1", ["example.com"])).toBe(false);
  });
  it("flags tracking parameters", () => {
    expect(isAffiliateUrl("https://x.test/p?aff=123", [])).toBe(true);
    expect(isAffiliateUrl("https://x.test/p?tag=site-20", [])).toBe(true);
    expect(isAffiliateUrl("https://x.test/p?utm_medium=Affiliate", [])).toBe(true);
  });
  it("leaves ordinary links alone", () => {
    expect(isAffiliateUrl("https://www.youtube.com/watch?v=abcdefghijk", [])).toBe(false);
    expect(isAffiliateUrl("not a url", ["example.com"])).toBe(false);
  });
});
