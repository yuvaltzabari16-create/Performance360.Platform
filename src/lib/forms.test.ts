import { describe, expect, it } from "vitest";
import { csv, int, isUuid, lines, num, oneOf, safeNext, str } from "./forms";

function fd(entries: Record<string, string>) {
  const f = new FormData();
  Object.entries(entries).forEach(([k, v]) => f.set(k, v));
  return f;
}

describe("form parsing", () => {
  it("trims and nulls empty strings", () => {
    expect(str(fd({ a: "  hi " }), "a")).toBe("hi");
    expect(str(fd({ a: "   " }), "a")).toBeNull();
    expect(str(fd({}), "a")).toBeNull();
  });
  it("parses numbers with comma decimals", () => {
    expect(num(fd({ a: "1,85" }), "a")).toBe(1.85);
    expect(num(fd({ a: "abc" }), "a")).toBeNull();
    expect(int(fd({ a: "3.6" }), "a")).toBe(4);
  });
  it("splits lists", () => {
    expect(lines(fd({ a: "one\n\n two \r\nthree" }), "a")).toEqual(["one", "two", "three"]);
    expect(csv(fd({ a: "Barbell, rack ,," }), "a")).toEqual(["barbell", "rack"]);
  });
  it("restricts enums", () => {
    expect(oneOf(fd({ a: "x" }), "a", ["y", "z"] as const, "y")).toBe("y");
    expect(oneOf(fd({ a: "z" }), "a", ["y", "z"] as const, "y")).toBe("z");
  });
  it("validates uuids", () => {
    expect(isUuid("aaaaaaaa-0000-0000-0000-000000000001")).toBe(true);
    expect(isUuid("1 or 1=1")).toBe(false);
  });
  it("blocks open redirects", () => {
    expect(safeNext("/athletes")).toBe("/athletes");
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
  });
});
