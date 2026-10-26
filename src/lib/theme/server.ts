import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, type Theme } from "./theme";

/** The saved colour theme choice for this request. */
export async function getTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
