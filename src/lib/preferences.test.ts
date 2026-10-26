import { describe, expect, it } from "vitest";
import { hour12Option, parseMotion, parsePreferences, parseTextSize, startPath, weekStartDay } from "./preferences";

describe("preferences", () => {
  it("falls back to defaults for junk", () => {
    expect(parsePreferences(null)).toEqual({ phone: "", job_title: "", week_start: "auto", time_format: "auto", start_page: "dashboard" });
    expect(parsePreferences({ week_start: "tuesday", time_format: 5, start_page: "admin" }).week_start).toBe("auto");
    expect(parsePreferences({ start_page: "admin" }).start_page).toBe("dashboard");
  });
  it("keeps valid values and cleans text", () => {
    const p = parsePreferences({ phone: "+972 (50) 123-4567 <script>", job_title: "  Head of\nPerformance ", week_start: "saturday", time_format: "12h", start_page: "calendar" });
    expect(p.phone).toBe("+972 (50) 123-4567");
    expect(p.job_title).toBe("Head of Performance");
    expect([p.week_start, p.time_format, p.start_page]).toEqual(["saturday", "12h", "calendar"]);
  });
  it("caps long text", () => {
    expect(parsePreferences({ job_title: "x".repeat(500) }).job_title).toHaveLength(80);
    expect(parsePreferences({ phone: "1".repeat(500) }).phone).toHaveLength(30);
  });
  it("maps the week start", () => {
    expect(weekStartDay("auto", "he")).toBe(0);
    expect(weekStartDay("auto", "en")).toBe(1);
    expect(weekStartDay("saturday", "en")).toBe(6);
    expect(weekStartDay("sunday", "en")).toBe(0);
  });
  it("maps the clock", () => {
    expect(hour12Option("24h")).toEqual({ hour12: false });
    expect(hour12Option("12h")).toEqual({ hour12: true });
    expect(hour12Option("auto")).toEqual({});
  });
  it("only opens a start page the login may open", () => {
    expect(startPath("calendar", ["dashboard", "calendar"])).toBe("/calendar");
    expect(startPath("training", ["dashboard", "calendar"])).toBe("/dashboard");
  });
  it("reads display cookies safely", () => {
    expect(parseTextSize("large")).toBe("large");
    expect(parseTextSize("huge")).toBe("normal");
    expect(parseMotion("reduce")).toBe("reduce");
    expect(parseMotion(undefined)).toBe("normal");
  });
});
