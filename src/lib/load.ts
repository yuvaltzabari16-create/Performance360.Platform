import { addDays, isoDate } from "./dates";

/**
 * Session-RPE load monitoring (Foster): load = RPE × minutes, summed per day.
 * Acute = mean daily load over the last 7 days, chronic = mean over 28 days,
 * ACWR = acute / chronic. Days without sessions count as zero.
 */
export interface LoadSummary {
  acute: number;
  chronic: number;
  acwr: number | null;
  daily: Record<string, number>;
}

export function dailyLoads(rows: { session_date: string; load: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.session_date] = (out[r.session_date] ?? 0) + r.load;
  return out;
}

export function summarize(rows: { session_date: string; load: number }[], end = isoDate()): LoadSummary {
  const daily = dailyLoads(rows);
  let a = 0, c = 0;
  for (let i = 0; i < 28; i++) {
    const v = daily[addDays(end, -i)] ?? 0;
    c += v;
    if (i < 7) a += v;
  }
  const acute = a / 7, chronic = c / 28;
  return { acute, chronic, acwr: chronic > 0 ? acute / chronic : null, daily };
}

/** <0.8 underloaded, 0.8–1.3 sweet spot, 1.3–1.5 caution, >1.5 spike. */
export function acwrTone(v: number | null): "good" | "warn" | "bad" | "na" {
  if (v == null) return "na";
  if (v > 1.5) return "bad";
  if (v > 1.3 || v < 0.8) return "warn";
  return "good";
}

export const CR10 = {
  en: ["Rest", "Very, very easy", "Easy", "Moderate", "Somewhat hard", "Hard", "Hard+", "Very hard", "Very hard+", "Very, very hard", "Maximal"],
  he: ["מנוחה", "קל מאוד מאוד", "קל", "בינוני", "די קשה", "קשה", "קשה+", "קשה מאוד", "קשה מאוד+", "קשה מאוד מאוד", "מקסימלי"],
};
