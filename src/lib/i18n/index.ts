import { cookies } from "next/headers";
import en, { type Dictionary } from "./en";
import he from "./he";
import type { Locale } from "../types";

export const LOCALE_COOKIE = "p360-locale";
const dictionaries: Record<Locale, Dictionary> = { en, he };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}

/** Locale for visitors who are not signed in (cookie, defaulting to English). */
export async function getCookieLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === "he" ? "he" : "en";
}

export type { Dictionary };
