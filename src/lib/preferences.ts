import { SECTIONS, type Section } from "@/lib/permissions";

/** Personal preferences saved on the profile (profiles.preferences). Everything is optional; "auto" follows the language. */
export const WEEK_STARTS = ["auto", "monday", "sunday", "saturday"] as const;
export const TIME_FORMATS = ["auto", "24h", "12h"] as const;
/** Pages that can be the first page after sign-in (the person's role decides which are available). */
export const START_PAGES = ["dashboard", "calendar", "athletes", "training", "injuries", "messages", "gps"] as const satisfies readonly Section[];

export type WeekStart = (typeof WEEK_STARTS)[number];
export type TimeFormat = (typeof TIME_FORMATS)[number];
export type StartPage = (typeof START_PAGES)[number];

export interface Preferences {
  phone: string;
  job_title: string;
  week_start: WeekStart;
  time_format: TimeFormat;
  start_page: StartPage;
}

export const DEFAULT_PREFERENCES: Preferences = { phone: "", job_title: "", week_start: "auto", time_format: "auto", start_page: "dashboard" };

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

/** Reads stored (or submitted) values into a valid object; anything unknown falls back to the default. */
export function parsePreferences(raw: unknown): Preferences {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    phone: text(o.phone, 30).replace(/[^0-9+()\-\s.]/g, "").trim(),
    job_title: text(o.job_title, 80),
    week_start: pick(o.week_start, WEEK_STARTS, "auto"),
    time_format: pick(o.time_format, TIME_FORMATS, "auto"),
    start_page: pick(o.start_page, START_PAGES, "dashboard"),
  };
}

/** 0 = Sunday ... 6 = Saturday, for the calendar grid. "Auto" means Sunday in Hebrew and Monday in English. */
export function weekStartDay(pref: WeekStart, locale: string): 0 | 1 | 6 {
  if (pref === "sunday") return 0;
  if (pref === "monday") return 1;
  if (pref === "saturday") return 6;
  return locale === "he" ? 0 : 1;
}

/** Options for Intl.DateTimeFormat: 24-hour or 12-hour clock, or the language's own habit. */
export function hour12Option(pref: TimeFormat): { hour12?: boolean } {
  return pref === "24h" ? { hour12: false } : pref === "12h" ? { hour12: true } : {};
}

/** The page to open after sign-in: the chosen one if this login may open it, otherwise the dashboard. */
export function startPath(pref: StartPage, allowed: readonly Section[]): string {
  return (SECTIONS as readonly string[]).includes(pref) && allowed.includes(pref) ? `/${pref}` : "/dashboard";
}

/** Display settings kept in cookies so the server can apply them before the first paint. */
export const TEXT_SIZES = ["small", "normal", "large"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const TEXT_COOKIE = "p360-text";
export const MOTION_COOKIE = "p360-motion";
export const parseTextSize = (v: string | null | undefined): TextSize => pick(v, TEXT_SIZES, "normal");
export const parseMotion = (v: string | null | undefined): "reduce" | "normal" => (v === "reduce" ? "reduce" : "normal");
