import type { FieldKey } from "@/lib/builder-fields";
import type { SessionSection } from "@/lib/catalog";

/**
 * Data model of Performance360 Lite. Everything lives in one plain object that is saved in the browser and can be
 * exported to / imported from a JSON file. All functions here are pure so they can be tested without a browser.
 */

export const SCHEMA_VERSION = 1;
export type Lang = "en" | "he";
export type Theme = "auto" | "light" | "dark";

export interface Athlete { id: string; name: string; sport: string; position: string; notes: string; createdAt: string }
export interface CheckIn {
  id: string; athleteId: string; date: string;
  sleepHours: number | null; sleepQuality: number | null; fatigue: number | null; soreness: number | null;
  stress: number | null; mood: number | null; motivation: number | null; pain: boolean; painNote: string;
}
export interface TestEntry { id: string; athleteId: string; date: string; name: string; unit: string; value: number; higherIsBetter: boolean }
export interface InjuryEvent { at: string; stage: string; note: string }
export interface Injury {
  id: string; athleteId: string; area: string; injuryDate: string; expectedReturn: string | null;
  stage: string; status: "open" | "resolved"; note: string; events: InjuryEvent[];
}
export interface LoadRow { id: string; athleteId: string; date: string; load: number }
export interface SessionItem { id: string; exerciseId: string; name: string; section: SessionSection; values: Partial<Record<FieldKey, string>> }
export interface TrainingSession { id: string; title: string; items: SessionItem[] }
export interface Program { id: string; title: string; sessions: TrainingSession[]; createdAt: string }

export interface LiteState {
  version: number;
  lang: Lang;
  theme: Theme;
  lastExportAt: string | null;
  athletes: Athlete[];
  checkIns: CheckIn[];
  tests: TestEntry[];
  injuries: Injury[];
  loads: LoadRow[];
  programs: Program[];
}

export const emptyState = (lang: Lang = "en"): LiteState => ({
  version: SCHEMA_VERSION, lang, theme: "auto", lastExportAt: null,
  athletes: [], checkIns: [], tests: [], injuries: [], loads: [], programs: [],
});

export const INJURY_STAGES = ["rest", "rehab", "running", "modified", "full", "cleared"] as const;
export const BODY_AREAS = ["hamstring", "quadriceps", "groin", "calf", "ankle", "knee", "hip", "foot", "lower_back", "shoulder", "head", "other"] as const;
const SECTIONS = ["warmup", "mobility", "activation", "sprint", "plyometrics", "strength", "power", "cod", "conditioning", "core", "recovery", "cooldown"] as const;
const FIELDS = ["reps", "load", "pct1rm", "rpe", "rir", "tempo", "duration", "distance", "rest", "intensity"] as const;

export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const todayIso = (now = new Date()) => {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0"), d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// ---- sanitising (used for every imported file: never trust its shape) -------------------------------------------

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const num = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback);
const idOf = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 80 ? v : newId());
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const stamp = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

export function sanitizeState(input: unknown): LiteState {
  const raw = rec(input);
  const athletes: Athlete[] = arr(raw.athletes).map(rec).filter((a) => str(a.name, 120)).slice(0, 2000).map((a) => ({
    id: idOf(a.id), name: str(a.name, 120), sport: str(a.sport, 80), position: str(a.position, 80), notes: str(a.notes, 4000), createdAt: stamp(a.createdAt),
  }));
  const known = new Set(athletes.map((a) => a.id));
  const checkIns: CheckIn[] = arr(raw.checkIns).map(rec).filter((c) => known.has(String(c.athleteId)) && isDate(c.date)).slice(0, 50000).map((c) => ({
    id: idOf(c.id), athleteId: String(c.athleteId), date: c.date as string, sleepHours: num(c.sleepHours, 0, 24),
    sleepQuality: num(c.sleepQuality, 1, 5), fatigue: num(c.fatigue, 1, 5), soreness: num(c.soreness, 1, 5), stress: num(c.stress, 1, 5),
    mood: num(c.mood, 1, 5), motivation: num(c.motivation, 1, 5), pain: c.pain === true, painNote: str(c.painNote, 500),
  }));
  const tests: TestEntry[] = arr(raw.tests).map(rec).filter((t) => known.has(String(t.athleteId)) && isDate(t.date) && str(t.name, 120) && num(t.value, -1e9, 1e9) !== null).slice(0, 50000).map((t) => ({
    id: idOf(t.id), athleteId: String(t.athleteId), date: t.date as string, name: str(t.name, 120), unit: str(t.unit, 20), value: t.value as number, higherIsBetter: t.higherIsBetter !== false,
  }));
  const injuries: Injury[] = arr(raw.injuries).map(rec).filter((i) => known.has(String(i.athleteId)) && isDate(i.injuryDate)).slice(0, 20000).map((i) => ({
    id: idOf(i.id), athleteId: String(i.athleteId), area: oneOf(i.area, BODY_AREAS, "other"), injuryDate: i.injuryDate as string,
    expectedReturn: isDate(i.expectedReturn) ? i.expectedReturn : null, stage: oneOf(i.stage, INJURY_STAGES, "rest"),
    status: i.status === "resolved" ? "resolved" : "open", note: str(i.note, 2000),
    events: arr(i.events).map(rec).slice(0, 200).map((e) => ({ at: stamp(e.at), stage: oneOf(e.stage, INJURY_STAGES, "rest"), note: str(e.note, 2000) })),
  }));
  const loads: LoadRow[] = arr(raw.loads).map(rec).filter((l) => known.has(String(l.athleteId)) && isDate(l.date) && num(l.load, 0, 100000) !== null).slice(0, 100000).map((l) => ({
    id: idOf(l.id), athleteId: String(l.athleteId), date: l.date as string, load: l.load as number,
  }));
  const programs: Program[] = arr(raw.programs).map(rec).filter((p) => str(p.title, 160)).slice(0, 2000).map((p) => ({
    id: idOf(p.id), title: str(p.title, 160), createdAt: stamp(p.createdAt),
    sessions: arr(p.sessions).map(rec).slice(0, 400).map((s) => ({
      id: idOf(s.id), title: str(s.title, 160) || "Session",
      items: arr(s.items).map(rec).filter((it) => str(it.name, 160)).slice(0, 200).map((it) => {
        const values: Partial<Record<FieldKey, string>> = {};
        const vv = rec(it.values);
        for (const k of FIELDS) { const t = str(vv[k], 120); if (t) values[k] = t; }
        return { id: idOf(it.id), exerciseId: str(it.exerciseId, 80), name: str(it.name, 160), section: oneOf(it.section, SECTIONS, "strength"), values };
      }),
    })),
  }));
  return {
    version: SCHEMA_VERSION, lang: raw.lang === "he" ? "he" : "en", theme: oneOf(raw.theme, ["auto", "light", "dark"] as const, "auto"),
    lastExportAt: typeof raw.lastExportAt === "string" ? raw.lastExportAt : null,
    athletes, checkIns, tests, injuries, loads, programs,
  };
}

export type ImportResult = { ok: true; state: LiteState; counts: { athletes: number; programs: number } } | { ok: false; error: "not_json" | "too_new" | "empty" };

export function parseImport(text: string): ImportResult {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: "not_json" }; }
  const raw = rec(data);
  if (typeof raw.version === "number" && raw.version > SCHEMA_VERSION) return { ok: false, error: "too_new" };
  if (!Array.isArray(raw.athletes) && !Array.isArray(raw.programs)) return { ok: false, error: "empty" };
  const state = sanitizeState(raw);
  return { ok: true, state, counts: { athletes: state.athletes.length, programs: state.programs.length } };
}

export const exportJson = (s: LiteState) => JSON.stringify({ ...s, version: SCHEMA_VERSION }, null, 2);

// ---- small pure helpers used by the screens ---------------------------------------------------------------------

export const replaceById = <T extends { id: string }>(list: T[], item: T): T[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);
export const removeById = <T extends { id: string }>(list: T[], id: string): T[] => list.filter((x) => x.id !== id);

/** Removes an athlete together with everything recorded for them. */
export function removeAthlete(s: LiteState, id: string): LiteState {
  return {
    ...s, athletes: removeById(s.athletes, id),
    checkIns: s.checkIns.filter((c) => c.athleteId !== id), tests: s.tests.filter((t) => t.athleteId !== id),
    injuries: s.injuries.filter((i) => i.athleteId !== id), loads: s.loads.filter((l) => l.athleteId !== id),
  };
}

/** One check-in per athlete and day: saving again replaces the earlier one. */
export function saveCheckIn(s: LiteState, c: CheckIn): LiteState {
  const rest = s.checkIns.filter((x) => !(x.athleteId === c.athleteId && x.date === c.date));
  return { ...s, checkIns: [...rest, c] };
}

/** Moves an injury to a stage. Clearing needs a written basis, like in the shared app. */
export function setInjuryStage(i: Injury, stage: string, note: string, now = new Date()): Injury | { error: "note_required" | "same_stage" } {
  if (stage === i.stage) return { error: "same_stage" };
  const text = note.trim();
  if (stage === "cleared" && text.length < 3) return { error: "note_required" };
  const events = [...i.events, { at: now.toISOString(), stage, note: text.slice(0, 2000) }];
  return { ...i, stage, status: stage === "cleared" ? "resolved" : "open", events };
}

/** Parses "athlete,date,load" lines (header optional, comma / semicolon / tab) into rows for known athletes. */
export function parseLoadCsv(text: string, athletes: Athlete[]): { rows: LoadRow[]; skipped: number } {
  const byName = new Map(athletes.map((a) => [a.name.trim().toLowerCase(), a.id]));
  const rows: LoadRow[] = [];
  let skipped = 0;
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [name, date, load] = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    const id = byName.get((name ?? "").toLowerCase());
    const n = Number((load ?? "").replace(",", "."));
    if (!id || !isDate(date) || !Number.isFinite(n) || n < 0 || n > 100000) { if (!/^athlete|name/i.test(name ?? "")) skipped += 1; continue; }
    rows.push({ id: newId(), athleteId: id, date, load: n });
  }
  return { rows: rows.slice(0, 20000), skipped };
}

/** Guards a CSV cell against spreadsheet formulas. */
export const csvCell = (v: string | number | null | undefined): string => {
  let t = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",;\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
