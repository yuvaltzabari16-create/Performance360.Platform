import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePlans } from "./config";

const plan = (over: object = {}) => ({ id: "pro", name: "Pro", checkoutUrl: "https://pay.example.com/c/1", ...over });

describe("payment plans (external hosted checkout only)", () => {
  it("accepts https checkout links", () => {
    expect(parsePlans(JSON.stringify([plan()]))).toEqual([{ id: "pro", name: "Pro", description: null, checkoutUrl: "https://pay.example.com/c/1" }]);
  });
  it("drops insecure, malformed and disallowed entries", () => {
    const raw = JSON.stringify([plan({ checkoutUrl: "http://pay.example.com/c" }), plan({ checkoutUrl: "javascript:alert(1)" }), plan({ name: "" }), plan({ checkoutUrl: "https://evil.test/c" })]);
    expect(parsePlans(raw, ["pay.example.com"])).toEqual([]);
    expect(parsePlans("not json")).toEqual([]);
    expect(parsePlans(undefined)).toEqual([]);
  });
});

/** Guard: card-entry fields must never appear in this codebase. */
describe("no card data handled in the app", () => {
  const files: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(name) && !name.endsWith(".test.ts")) files.push({ path: p, text: readFileSync(p, "utf8") });
    }
  };
  walk(join(process.cwd(), "src"));
  const CARD_FIELD = /(autoComplete|autocomplete)\s*=\s*["']cc-|name\s*=\s*["'](card[-_]?number|cardnumber|cvv|cvc|card[-_]?cvc|expiry|exp[-_]?date)["']/i;
  it("has no credit-card input fields", () => {
    const hits = files.filter((f) => CARD_FIELD.test(f.text)).map((f) => f.path);
    expect(hits).toEqual([]);
  });
  it("does not load a payment SDK that renders card fields in the page", () => {
    const hits = files.filter((f) => /js\.stripe\.com|@stripe\/(react-)?stripe-js|checkout\.paypal\.com\/sdk|pci-?fields/i.test(f.text)).map((f) => f.path);
    expect(hits).toEqual([]);
  });
});
