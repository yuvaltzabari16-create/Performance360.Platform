/** Local calendar date as YYYY-MM-DD (the athlete's own day, not UTC). */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

/** Last n days ending today, oldest first. */
export function lastDays(n: number, end = isoDate()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

export function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

export function fmtDay(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", opts).format(new Date(y, m - 1, d));
}

export function readinessTone(v: number | null | undefined): "good" | "warn" | "bad" | "na" {
  if (v == null) return "na";
  return v >= 70 ? "good" : v >= 50 ? "warn" : "bad";
}
