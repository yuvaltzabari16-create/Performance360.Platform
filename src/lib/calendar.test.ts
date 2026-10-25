import { describe, expect, it } from "vitest";
import { buildEvents, monthGrid, parseMonth, sessionDate, shiftMonth } from "./calendar";

describe("calendar maths", () => {
  it("places sessions relative to the program start", () => {
    expect(sessionDate("2026-10-05", 1, 1)).toBe("2026-10-05");
    expect(sessionDate("2026-10-05", 1, 3)).toBe("2026-10-07");
    expect(sessionDate("2026-10-05", 2, 1)).toBe("2026-10-12");
    expect(sessionDate("2026-12-28", 2, 5)).toBe("2027-01-08"); // crosses a year
  });
  it("builds six full weeks per month, starting on the chosen weekday", () => {
    const sun = monthGrid(2026, 10, 0);
    expect(sun).toHaveLength(6);
    expect(sun.every((w) => w.length === 7)).toBe(true);
    expect(new Date(sun[0][0].iso + "T00:00:00Z").getUTCDay()).toBe(0);
    const mon = monthGrid(2026, 10, 1);
    expect(new Date(mon[0][0].iso + "T00:00:00Z").getUTCDay()).toBe(1);
    const sat = monthGrid(2026, 10, 6);
    expect(new Date(sat[0][0].iso + "T00:00:00Z").getUTCDay()).toBe(6);
    expect(sat.flat().filter((d) => d.inMonth)).toHaveLength(31);
    expect(sun.flat().filter((d) => d.inMonth)).toHaveLength(31);
    expect(sun.flat().find((d) => d.iso === "2026-10-01")?.inMonth).toBe(true);
  });
  it("parses and shifts months safely", () => {
    expect(parseMonth("2026-03", "2026-10-22")).toEqual({ year: 2026, month: 3 });
    expect(parseMonth("2026-13", "2026-10-22")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("junk", "2026-10-22")).toEqual({ year: 2026, month: 10 });
    expect(shiftMonth(2026, 12, 1)).toBe("2027-01");
    expect(shiftMonth(2026, 1, -1)).toBe("2025-12");
  });
  it("combines assignments, sessions and completions", () => {
    const events = buildEvents(
      [{ assignmentId: "a", athleteId: "x", athleteName: "X", programId: "p", programTitle: "P", startDate: "2026-10-05" }],
      [{ id: "s1", programId: "p", week: 1, day: 1, title: "Mon", minutes: 60 }, { id: "s2", programId: "p", week: 1, day: 3, title: "Wed", minutes: null }],
      [{ sessionId: "s1", athleteId: "x", status: "skipped" }, { sessionId: "s1", athleteId: "x", status: "completed" }],
    );
    expect(events.map((e) => [e.date, e.status])).toEqual([["2026-10-05", "completed"], ["2026-10-07", "planned"]]);
  });
});
