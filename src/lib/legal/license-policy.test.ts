import { describe, expect, it } from "vitest";
import manifest from "./assets.json";
import { findAssetUsage, isAllowedExpression, validateManifest } from "./license-policy.mjs";

describe("license policy", () => {
  it("evaluates SPDX expressions", () => {
    expect(isAllowedExpression("MIT")).toBe(true);
    expect(isAllowedExpression("(MIT OR GPL-3.0)")).toBe(true);
    expect(isAllowedExpression("MIT AND ISC")).toBe(true);
    expect(isAllowedExpression("MIT AND GPL-3.0")).toBe(false);
    expect(isAllowedExpression("GPL-3.0-only")).toBe(false);
    expect(isAllowedExpression("")).toBe(false);
  });
  it("detects undeclared font and icon usage", () => {
    const hits = findAssetUsage([
      { path: "a.css", text: "@font-face { src: url(x.woff2) }" },
      { path: "b.tsx", text: 'import { Home } from "lucide-react";' },
      { path: "c.tsx", text: "const ok = 1" },
    ]);
    expect(hits.map((h: { kind: string }) => h.kind).sort()).toEqual(["font", "font", "icon"]);
  });
  it("the shipped asset manifest is valid", () => {
    expect(validateManifest(manifest)).toEqual([]);
  });
  it("rejects an asset with a bad license or no source", () => {
    expect(validateManifest({ fonts: [{ name: "X", license: "Proprietary-Commercial", source: "s" }] })).toHaveLength(1);
    expect(validateManifest({ icons: [{ name: "Y", license: "MIT" }] })).toHaveLength(1);
  });
});
