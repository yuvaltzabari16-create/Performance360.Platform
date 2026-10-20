// Calendar dates in the user's own time zone. A plain
// `new Date().toISOString().slice(0, 10)` gives the UTC date, which is wrong
// between midnight and 03:00 in Israel (and similarly elsewhere).

export const TZ_COOKIE = "p360-tz";
export const DEFAULT_TIME_ZONE = "UTC";

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** YYYY-MM-DD for `at` as seen in time zone `tz`. */
export function dateInZone(at: Date, tz: string): string {
  const zone = isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Adds whole days to a YYYY-MM-DD calendar date (no time-zone effects). */
export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
