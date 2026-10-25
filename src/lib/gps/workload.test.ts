import { describe, expect, it } from "vitest";
import { statusOf, workloads } from "./workload";

const day = (n: number) => new Date(Date.UTC(2026, 9, 28) - n * 86_400_000).toISOString().slice(0, 10);

describe("workloads", () => {
  it("is empty without sessions", () => expect(workloads([])).toEqual([]));

  it("gives a steady athlete a ratio near 1", () => {
    const entries = [0, 7, 14, 21].map((n) => ({ athleteId: "a", date: day(n), load: 100 }));
    const [w] = workloads(entries);
    expect(w.ratio).toBe(1);
    expect(w.status).toBe("ok");
  });

  it("flags a spike", () => {
    const entries = [{ athleteId: "a", date: day(0), load: 300 }, { athleteId: "a", date: day(1), load: 300 }, { athleteId: "a", date: day(20), load: 100 }, { athleteId: "a", date: day(27), load: 100 }];
    const [w] = workloads(entries);
    expect(w.status).toBe("high");
    expect(w.acute).toBe(600);
  });

  it("flags a drop", () => {
    const entries = [{ athleteId: "a", date: day(0), load: 20 }, { athleteId: "a", date: day(10), load: 200 }, { athleteId: "a", date: day(20), load: 200 }, { athleteId: "a", date: day(27), load: 200 }];
    expect(workloads(entries)[0].status).toBe("low");
  });

  it("does not guess with under two weeks of history", () => {
    expect(workloads([{ athleteId: "a", date: day(0), load: 100 }, { athleteId: "a", date: day(5), load: 100 }])[0].status).toBe("unknown");
  });

  it("lists the riskiest athlete first", () => {
    const base = [{ date: day(0), load: 100 }, { date: day(14), load: 100 }, { date: day(21), load: 100 }];
    const entries = [...base.map((e) => ({ ...e, athleteId: "ok" })), ...base.map((e) => ({ ...e, athleteId: "hot", load: e.date === day(0) ? 600 : 50 }))];
    expect(workloads(entries)[0].athleteId).toBe("hot");
  });

  it("classifies the boundaries", () => {
    expect([statusOf(1.5), statusOf(1.51), statusOf(0.8), statusOf(0.79), statusOf(null)]).toEqual(["ok", "high", "ok", "low", "unknown"]);
  });
});
