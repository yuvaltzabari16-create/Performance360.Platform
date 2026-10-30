import { describe, expect, it, vi } from "vitest";
import { connectCloud, demoState, diffDocs, fromDocs, toDocs, type CloudStatus } from "./cloud";
import { emptyState, type LiteState } from "./model";

const prefs = { lang: "en" as const, theme: "auto" as const };
const sample = (): LiteState => {
  const s = emptyState("en");
  s.athletes = [
    { id: "a1", name: "Ari", sport: "Football", position: "Winger", notes: "private", createdAt: "2026-10-01T00:00:00.000Z" },
    { id: "a2", name: "Noa", sport: "", position: "", notes: "", createdAt: "2026-10-01T00:00:00.000Z", userId: "u_noa" },
  ];
  const ci = (id: string, athleteId: string, date: string) => ({ id, athleteId, date, sleepHours: 7, sleepQuality: 4, fatigue: 2, soreness: 2, stress: 2, mood: 4, motivation: 4, pain: false, painNote: "" });
  s.checkIns = [ci("c1", "a1", "2026-10-26"), ci("c2", "a1", "2026-10-27"), ci("c3", "a1", "2026-09-30"), ci("c4", "a2", "2026-10-27")];
  s.tests = [{ id: "t1", athleteId: "a1", date: "2026-10-01", name: "CMJ", unit: "cm", value: 38, higherIsBetter: true }];
  s.loads = [{ id: "l1", athleteId: "a1", date: "2026-10-27", load: 450 }];
  s.injuries = [{ id: "i1", athleteId: "a1", area: "calf", injuryDate: "2026-10-20", expectedReturn: null, stage: "rehab", status: "open", note: "", events: [] }];
  s.programs = [{ id: "p1", title: "Week 1", createdAt: "2026-10-01T00:00:00.000Z", sessions: [] }];
  return s;
};

describe("documents", () => {
  it("groups check-ins by account (or athlete) and month, with only even-length document paths", () => {
    const docs = toDocs(sample());
    expect([...docs.keys()].sort()).toEqual([
      "athletes/a1", "athletes/a2", "checkins/a1/months/2026-09", "checkins/a1/months/2026-10", "checkins/u_noa/link/me", "checkins/u_noa/months/2026-10",
      "injuries/i1", "loads/a1", "programs/p1", "tests/a1",
    ]);
    for (const p of docs.keys()) expect(p.split("/").length % 2).toBe(0);
  });

  it("round-trips the state", () => {
    const s = sample();
    const back = fromDocs(toDocs(s), prefs);
    expect(back.athletes.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
    expect(back.athletes.find((a) => a.id === "a2")?.userId).toBe("u_noa");
    expect(back.checkIns).toHaveLength(4);
    expect(back.tests).toHaveLength(1);
    expect(back.loads).toHaveLength(1);
    expect(back.injuries).toHaveLength(1);
    expect(back.programs).toHaveLength(1);
  });

  it("writes only what changed, and deletes what disappeared", () => {
    const s = sample();
    const before = toDocs(s);
    expect(diffDocs(before, toDocs(s))).toEqual([]);
    const moved = { ...s, injuries: [], checkIns: s.checkIns.filter((c) => c.id !== "c3"), athletes: s.athletes.map((a) => (a.id === "a1" ? { ...a, notes: "x" } : a)) };
    const ops = diffDocs(before, toDocs(moved));
    expect(ops.map((o) => `${o.path}:${o.data ? "set" : "delete"}`).sort()).toEqual(["athletes/a1:set", "checkins/a1/months/2026-09:delete", "injuries/i1:delete"]);
  });

  it("moves an athlete's check-ins when an account is linked", () => {
    const s = sample();
    const linked = { ...s, athletes: s.athletes.map((a) => (a.id === "a1" ? { ...a, userId: "u_ari" } : a)) };
    const ops = diffDocs(toDocs(s), toDocs(linked)).map((o) => `${o.path}:${o.data ? "set" : "delete"}`);
    expect(ops).toContain("checkins/u_ari/link/me:set");
    expect(ops).toContain("checkins/u_ari/months/2026-10:set");
    expect(ops).toContain("checkins/a1/months/2026-10:delete");
  });

  it("shows an athlete signed in with their own account only their own link and check-ins", () => {
    const own = new Map([...toDocs(sample())].filter(([p]) => p.startsWith("checkins/u_noa/")));
    const s = fromDocs(own, prefs);
    expect(s.athletes).toHaveLength(1);
    expect(s.athletes[0]).toMatchObject({ id: "a2", name: "Noa", userId: "u_noa" });
    expect(s.checkIns).toHaveLength(1);
    // Saving from that view writes only check-in documents under the athlete's own key.
    expect([...toDocs(s, "checkins").keys()]).toEqual(["checkins/u_noa/months/2026-10"]);
  });

  it("survives damaged documents", () => {
    const docs = toDocs(sample());
    docs.set("tests/a1", { items: "nope" });
    docs.set("loads/a1", { items: [{ nonsense: true }] });
    const s = fromDocs(docs, prefs);
    expect(s.tests).toEqual([]);
    expect(s.loads).toEqual([]);
  });

  it("builds example data that never claims to be real", () => {
    const d = demoState("en", "2026-10-28");
    expect(d.athletes.every((a) => a.name.startsWith("Example"))).toBe(true);
    expect(d.checkIns.length).toBeGreaterThan(10);
  });
});

// A small in-memory stand-in for the artifact store.
function fakeDb() {
  const data = new Map<string, Record<string, unknown>>();
  const listeners: { col: string; fn: (s: { docs: { id: string; data(): Record<string, unknown> }[] }) => void }[] = [];
  const snap = (col: string) => ({ docs: [...data].filter(([p]) => p.startsWith(`${col}/`) && p.slice(col.length + 1).split("/").length === 1).map(([p, d]) => ({ id: p.slice(col.length + 1), data: () => d })) });
  const notify = (path: string) => { for (const l of listeners) if (path.startsWith(`${l.col}/`)) l.fn(snap(l.col)); };
  const sets: string[] = [];
  return {
    data, sets,
    db: {
      collection: (col: string) => ({
        onSnapshot: (fn: (s: ReturnType<typeof snap>) => void) => { const l = { col, fn }; listeners.push(l); queueMicrotask(() => fn(snap(col))); return () => { listeners.splice(listeners.indexOf(l), 1); }; },
        doc: () => { throw new Error("unused"); },
      }),
      doc: (path: string) => ({
        set: async (d: Record<string, unknown>) => { sets.push(`set ${path}`); data.set(path, d); notify(path); },
        delete: async () => { sets.push(`delete ${path}`); data.delete(path); notify(path); },
      }),
    },
  };
}

describe("connectCloud", () => {
  it("loads staff data, writes edits after a pause and does not write again for its own echo", async () => {
    vi.useFakeTimers();
    const f = fakeDb();
    for (const [p, d] of toDocs(sample())) f.data.set(p, d);
    let state: LiteState | null = null;
    const statuses: CloudStatus[] = [];
    const cloud = connectCloud({ db: f.db as never, mode: "staff", userId: "u_coach", prefs: () => prefs, onState: (s) => { state = s; }, onStatus: (s) => statuses.push(s), debounceMs: 50 });
    await vi.advanceTimersByTimeAsync(10);
    expect(state).not.toBeNull();
    const loaded = state as unknown as LiteState;
    expect(loaded.athletes).toHaveLength(2);
    expect(statuses).toContain("live");

    cloud.push({ ...loaded, athletes: loaded.athletes.map((a) => (a.id === "a1" ? { ...a, name: "Ari B" } : a)) });
    cloud.push({ ...loaded, athletes: loaded.athletes.map((a) => (a.id === "a1" ? { ...a, name: "Ari Ben" } : a)) });
    await vi.advanceTimersByTimeAsync(200);
    expect(f.sets).toEqual(["set athletes/a1"]);
    expect(f.data.get("athletes/a1")).toMatchObject({ name: "Ari Ben" });
    expect((state as unknown as LiteState).athletes.find((a) => a.id === "a1")?.name).toBe("Ari Ben");
    cloud.dispose();
    vi.useRealTimers();
  });

  it("an athlete session reads and writes only under their own key", async () => {
    vi.useFakeTimers();
    const f = fakeDb();
    for (const [p, d] of toDocs(sample())) f.data.set(p, d);
    let state: LiteState | null = null;
    const cloud = connectCloud({ db: f.db as never, mode: "athlete", userId: "u_noa", prefs: () => prefs, onState: (s) => { state = s; }, onStatus: () => {}, debounceMs: 50 });
    await vi.advanceTimersByTimeAsync(10);
    const mine = state as unknown as LiteState;
    expect(mine.athletes.map((a) => a.id)).toEqual(["a2"]);
    expect(mine.checkIns.every((c) => c.athleteId === "a2")).toBe(true);
    cloud.push({ ...mine, checkIns: [...mine.checkIns, { ...mine.checkIns[0], id: "c9", date: "2026-10-28" }] });
    await vi.advanceTimersByTimeAsync(200);
    expect(f.sets.every((x) => x.startsWith("set checkins/u_noa/"))).toBe(true);
    expect(f.sets.length).toBeGreaterThan(0);
    cloud.dispose();
    vi.useRealTimers();
  });
});
