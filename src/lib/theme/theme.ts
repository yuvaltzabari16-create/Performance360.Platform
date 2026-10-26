/** Colour theme choice: stored in a cookie so the server can set it before the first paint (no flash). */
export const THEME_COOKIE = "p360-theme";
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const isTheme = (v: string | null | undefined): v is Theme => (THEMES as readonly string[]).includes(v ?? "");
export const parseTheme = (v: string | null | undefined): Theme => (isTheme(v) ? v : "system");
/** The next choice when someone taps the quick toggle: system, then light, then dark. */
export const nextTheme = (t: Theme): Theme => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
/** Attribute value for <html>; "system" sets nothing so the device decides. */
export const themeAttr = (t: Theme): "light" | "dark" | undefined => (t === "system" ? undefined : t);
