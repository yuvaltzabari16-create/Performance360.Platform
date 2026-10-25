import { describe, expect, it } from "vitest";
import { nextTheme, parseTheme, themeAttr } from "./theme";

describe("theme", () => {
  it("falls back to the device setting for anything unknown", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("blue")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
  });
  it("cycles system, light, dark", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });
  it("sets an attribute only for an explicit choice", () => {
    expect(themeAttr("system")).toBeUndefined();
    expect(themeAttr("dark")).toBe("dark");
  });
});
