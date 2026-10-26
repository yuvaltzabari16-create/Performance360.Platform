import { describe, expect, it } from "vitest";
import { staffAlerts } from "./alerts";

const today = "2026-10-28";
const day = (n: number) => new Date(Date.parse(today) - n * 86_400_000).toISOString().slice(0, 10);

describe("staffAlerts", () => {
  it("is empty with nothing to report", () => expect(staffAlerts([], [], today)).toEqual([]));

  it("flags low recovery from the last two days only", () => {
    const rows = [
      { athleteId: "a", day: day(1), recovery: 20 },
      { athleteId: "b", day: day(5), recovery: 10 },
      { athleteId: "c", day: day(0), recovery: 80 },
    ];
    expect(staffAlerts([], rows, today)).toEqual([{ athleteId: "a", kind: "recovery_low", value: 20 }]);
  });

  it("uses the latest reading per athlete", () => {
    const rows = [{ athleteId: "a", day: day(2), recovery: 10 }, { athleteId: "a", day: day(0), recovery: 70 }];
    expect(staffAlerts([], rows, today)).toEqual([]);
  });

  it("ignores missing recovery values", () => {
    expect(staffAlerts([], [{ athleteId: "a", day: day(0), recovery: null }], today)).toEqual([]);
  });

  it("puts high workload before low recovery", () => {
    const load = [{ athleteId: "h", date: day(0), load: 600 }, { athleteId: "h", date: day(14), load: 100 }, { athleteId: "h", date: day(21), load: 100 }, { athleteId: "h", date: day(27), load: 100 }];
    const out = staffAlerts(load, [{ athleteId: "r", day: day(0), recovery: 15 }], today);
    expect(out.map((a) => a.kind)).toEqual(["workload_high", "recovery_low"]);
  });
});
