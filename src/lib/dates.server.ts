import { cookies } from "next/headers";
import { DEFAULT_TIME_ZONE, TZ_COOKIE, addDays, dateInZone, isValidTimeZone } from "./dates";

/** The viewer's time zone, reported by the browser in a cookie (see TimeZoneCookie). */
export async function getTimeZone(): Promise<string> {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  return isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

/** Today's date (YYYY-MM-DD) in the viewer's time zone. */
export async function todayFor(): Promise<string> {
  return dateInZone(new Date(), await getTimeZone());
}

/** The date `n` days before today in the viewer's time zone. */
export async function daysAgo(n: number): Promise<string> {
  return addDays(await todayFor(), -n);
}
