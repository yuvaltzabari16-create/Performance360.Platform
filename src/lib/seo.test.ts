import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { PRIVATE_PREFIXES, PUBLIC_PAGES } from "./seo";

describe("robots and sitemap", () => {
  it("list only public pages and keep signed-in areas out", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls).toEqual(PUBLIC_PAGES.map((p) => p));
    for (const p of PRIVATE_PREFIXES) expect(PUBLIC_PAGES).not.toContain(p as never);
    const rules = robots().rules as { disallow: string[] };
    expect(rules.disallow).toContain("/dashboard");
    expect(rules.disallow).not.toContain("/privacy");
  });
});
