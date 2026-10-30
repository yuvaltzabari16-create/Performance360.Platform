import { emptyState, newId, sanitizeState, todayIso, type Athlete, type CheckIn, type LiteState } from "./model";

/**
 * The shared version keeps the same state as Lite, but in the artifact's own document store (the `db` capability).
 * This file has two halves: pure functions that turn the state into documents and back (unit tested), and the
 * runtime that subscribes to the store and writes only what changed.
 *
 * Document layout (a document path always has an even number of segments):
 *   athletes/{id}                       one athlete (notes are coach-only: the whole collection is staff-only)
 *   injuries/{id}, programs/{id}        one each
 *   tests/{athleteId}                   all tests of one athlete
 *   loads/{athleteId}                   all load rows of one athlete
 *   checkins/{key}/months/{yyyy-mm}     check-ins of one athlete for one month; key = linked account id, else athlete id
 *   checkins/{key}/link/me              who this account is (written by the coach when linking an account)
 * An athlete's own subtree, checkins/{their id}/..., is the only place a Contributor can read or write.
 */

export type Docs = Map<string, Record<string, unknown>>;
export type DocOp = { path: string; data: Record<string, unknown> | null };

export const keyOf = (a: Pick<Athlete, "id" | "userId">) => a.userId || a.id;
const monthOf = (date: string) => date.slice(0, 7);
// Document ids may only contain letters, digits and _ - . ~ : @ +. Ids made by newId() and the platform already do.
const safe = (id: string) => id.replace(/[^A-Za-z0-9_.~:@+-]/g, "_").slice(0, 190);

export function toDocs(s: LiteState, scope: "all" | "checkins" = "all"): Docs {
  const out: Docs = new Map();
  const keyById = new Map(s.athletes.map((a) => [a.id, keyOf(a)]));
  if (scope === "all") {
    for (const a of s.athletes) out.set(`athletes/${safe(a.id)}`, { ...a });
    for (const i of s.injuries) out.set(`injuries/${safe(i.id)}`, { ...i });
    for (const p of s.programs) out.set(`programs/${safe(p.id)}`, { ...p });
    const tests = new Map<string, unknown[]>();
    for (const t of s.tests) tests.set(t.athleteId, [...(tests.get(t.athleteId) ?? []), t]);
    for (const [id, items] of tests) out.set(`tests/${safe(id)}`, { athleteId: id, items });
    const loads = new Map<string, unknown[]>();
    for (const l of s.loads) loads.set(l.athleteId, [...(loads.get(l.athleteId) ?? []), l]);
    for (const [id, items] of loads) out.set(`loads/${safe(id)}`, { athleteId: id, items });
    for (const a of s.athletes) if (a.userId) out.set(`checkins/${safe(a.userId)}/link/me`, { athleteId: a.id, name: a.name });
  }
  const months = new Map<string, { key: string; athleteId: string; month: string; items: CheckIn[] }>();
  for (const c of s.checkIns) {
    const key = keyById.get(c.athleteId);
    if (!key) continue;
    const id = `${safe(key)}/months/${monthOf(c.date)}`;
    const cur = months.get(id) ?? { key, athleteId: c.athleteId, month: monthOf(c.date), items: [] };
    cur.items.push(c);
    months.set(id, cur);
  }
  for (const [id, m] of months) out.set(`checkins/${id}`, { athleteId: m.athleteId, month: m.month, items: m.items });
  return out;
}

export function diffDocs(prev: Docs, next: Docs): DocOp[] {
  const ops: DocOp[] = [];
  for (const [path, data] of next) if (JSON.stringify(prev.get(path)) !== JSON.stringify(data)) ops.push({ path, data });
  for (const path of prev.keys()) if (!next.has(path)) ops.push({ path, data: null });
  return ops;
}

/** Rebuilds the state from documents. Everything goes through sanitizeState, so a damaged document never crashes the page. */
export function fromDocs(docs: Docs, prefs: { lang: "en" | "he"; theme: LiteState["theme"] }): LiteState {
  const list = (prefix: string) => [...docs].filter(([p]) => p.startsWith(prefix)).map(([, d]) => d);
  const flat = (prefix: string) => list(prefix).flatMap((d) => (Array.isArray(d.items) ? (d.items as unknown[]) : []));
  const months = [...docs].filter(([p]) => /^checkins\/[^/]+\/months\//.test(p)).flatMap(([, d]) => (Array.isArray(d.items) ? (d.items as unknown[]) : []));
  const links = [...docs].filter(([p]) => /^checkins\/[^/]+\/link\/me$/.test(p)).map(([p, d]) => ({ userId: p.split("/")[1], ...d }));
  const athletes = list("athletes/").map((a) => ({ ...a }));
  // An athlete signed in with their own account only has the link document: show them as the one athlete.
  if (athletes.length === 0 && links.length === 1) athletes.push({ id: String((links[0] as { athleteId?: string }).athleteId ?? ""), name: String((links[0] as { name?: string }).name ?? ""), userId: links[0].userId });
  const state = sanitizeState({ athletes, checkIns: months, tests: flat("tests/"), loads: flat("loads/"), injuries: list("injuries/"), programs: list("programs/"), ...prefs });
  return { ...state, lang: prefs.lang, theme: prefs.theme };
}

/** Example data for visitors who are not signed in. Marked as examples in the app; never written anywhere. */
export function demoState(lang: "en" | "he", today = todayIso()): LiteState {
  const s = emptyState(lang);
  const day = (back: number) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - back); return todayIso(d); };
  const names = lang === "he" ? ["דוגמה: דנה", "דוגמה: נועם", "דוגמה: איתי"] : ["Example: Dana", "Example: Noam", "Example: Itay"];
  s.athletes = names.map((name, i) => ({ id: `demo-${i + 1}`, name, sport: lang === "he" ? "כדורגל" : "Football", position: ["Winger", "Keeper", "Midfielder"][i] ?? "", notes: "", createdAt: new Date().toISOString() }));
  for (const a of s.athletes) {
    for (let b = 0; b < 8; b += 1) {
      const lowDay = a.id === "demo-1" && b === 0;
      s.checkIns.push({ id: newId(), athleteId: a.id, date: day(b), sleepHours: lowDay ? 5.5 : 7.5, sleepQuality: lowDay ? 2 : 4, fatigue: lowDay ? 4 : 2, soreness: lowDay ? 4 : 2, stress: 2, mood: lowDay ? 2 : 4, motivation: 4, pain: lowDay, painNote: lowDay ? "Left hamstring tight" : "" });
    }
    for (let b = 0; b < 28; b += 1) s.loads.push({ id: newId(), athleteId: a.id, date: day(b), load: a.id === "demo-1" && b < 7 ? 640 : 420 });
  }
  s.injuries.push({ id: newId(), athleteId: "demo-3", area: "calf", injuryDate: day(9), expectedReturn: day(-5), stage: "rehab", status: "open", note: "", events: [{ at: new Date().toISOString(), stage: "rehab", note: "" }] });
  return s;
}

// ---- runtime -----------------------------------------------------------------------------------------------------

type Snap = { docs: { id: string; data(): Record<string, unknown> | undefined }[] };
interface DbRef { onSnapshot(next: (s: Snap) => void, error?: (e: { code: string }) => void): () => void }
interface Db { collection(path: string): DbRef & { doc(id: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> } }; doc(path: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> } }

export type CloudStatus = "connecting" | "live" | "saving" | "error" | "revoked";

export interface Cloud {
  /** Call after every local edit: the change is sent to the store shortly after the last keystroke. */
  push(next: LiteState): void;
  /** Sends any pending change now (used when the page is hidden or closed). */
  flushNow(): void;
  dispose(): void;
}

export interface CloudOptions {
  db: Db;
  /** "staff" reads and writes everything; "athlete" only the signed-in person's own check-ins. */
  mode: "staff" | "athlete";
  userId: string | null;
  prefs: () => { lang: "en" | "he"; theme: LiteState["theme"] };
  onState(s: LiteState): void;
  onStatus(s: CloudStatus): void;
  debounceMs?: number;
}

const COLLECTIONS = ["athletes", "injuries", "programs", "tests", "loads"] as const;

export function connectCloud(o: CloudOptions): Cloud {
  const remote: Docs = new Map();
  const scope = o.mode === "staff" ? "all" : "checkins";
  const subs: (() => void)[] = [];
  const monthSubs = new Map<string, () => void>();
  let synced: Docs = new Map();
  let latest: LiteState | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing = false;
  let dead = false;
  const loadedSet = new Set<string>();
  const needed = o.mode === "staff" ? COLLECTIONS.length : 2;

  const fail = (e: { code: string }) => o.onStatus(e.code === "revoked" ? "revoked" : "error");

  function rebuild() {
    if (dead || loadedSet.size < needed || timer !== undefined || writing) return;
    const s = fromDocs(remote, o.prefs());
    synced = toDocs(s, scope);
    latest = s;
    o.onState(s);
    o.onStatus("live");
    if (o.mode === "staff") syncMonthSubs(s.athletes);
  }

  function replacePrefix(prefix: string, snap: Snap, idPrefix = "") {
    for (const p of [...remote.keys()]) if (p.startsWith(prefix)) remote.delete(p);
    for (const d of snap.docs) { const data = d.data(); if (data) remote.set(`${prefix}${idPrefix}${d.id}`, data); }
  }

  function watchMonths(key: string) {
    if (monthSubs.has(key)) return;
    monthSubs.set(key, o.db.collection(`checkins/${key}/months`).onSnapshot((snap) => {
      replacePrefix(`checkins/${key}/months/`, snap);
      rebuild();
    }, fail));
  }
  function syncMonthSubs(athletes: Athlete[]) {
    const want = new Set(athletes.map((a) => safe(keyOf(a))));
    for (const k of want) watchMonths(k);
    for (const [k, off] of monthSubs) if (!want.has(k)) { off(); monthSubs.delete(k); for (const p of [...remote.keys()]) if (p.startsWith(`checkins/${k}/`)) remote.delete(p); }
  }

  if (o.mode === "staff") {
    for (const c of COLLECTIONS) {
      subs.push(o.db.collection(c).onSnapshot((snap) => { replacePrefix(`${c}/`, snap); loadedSet.add(c); rebuild(); }, fail));
    }
  } else if (o.userId) {
    const uid = safe(o.userId);
    subs.push(o.db.collection(`checkins/${uid}/link`).onSnapshot((snap) => {
      replacePrefix(`checkins/${uid}/link/`, snap);
      loadedSet.add("link");
      rebuild();
    }, fail));
    subs.push(o.db.collection(`checkins/${uid}/months`).onSnapshot((snap) => {
      replacePrefix(`checkins/${uid}/months/`, snap);
      loadedSet.add("months");
      rebuild();
    }, fail));
  }

  async function flush() {
    timer = undefined;
    if (dead || !latest) return;
    const next = toDocs(latest, scope);
    const ops = diffDocs(synced, next).filter((op) => scope === "all" || op.path.startsWith("checkins/"));
    if (ops.length === 0) { rebuild(); return; }
    writing = true;
    o.onStatus("saving");
    try {
      for (const op of ops) {
        const ref = o.db.doc(op.path);
        if (op.data) await ref.set(op.data); else await ref.delete();
        if (op.data) remote.set(op.path, op.data); else remote.delete(op.path);
      }
      synced = next;
      o.onStatus("live");
    } catch (e) {
      o.onStatus("error");
      console.warn("Performance360: save failed", e);
    } finally { writing = false; }
    rebuild();
  }

  return {
    push(next) {
      latest = next;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, o.debounceMs ?? 500);
    },
    flushNow() {
      if (timer === undefined) return;
      clearTimeout(timer);
      void flush();
    },
    dispose() {
      dead = true;
      if (timer !== undefined) clearTimeout(timer);
      for (const off of subs) off();
      for (const off of monthSubs.values()) off();
    },
  };
}
