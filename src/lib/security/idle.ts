/** Settings for automatic sign-out after inactivity (kept in a cookie so the server can render the choice). */

export const IDLE_COOKIE = "p360_idle_minutes";
/** Choices offered in Settings; 0 means never. */
export const IDLE_OPTIONS = [0, 15, 30, 60, 120] as const;
/** Default for new browsers: health data warrants a safe default. */
export const IDLE_DEFAULT = 60;
/** Seconds of warning before the automatic sign-out. */
export const IDLE_WARNING_SECONDS = 60;

/** Reads the stored choice; anything unexpected falls back to the default. */
export function parseIdleMinutes(value: string | null | undefined): number {
  if (value == null || value === "") return IDLE_DEFAULT;
  const n = Number(value);
  return (IDLE_OPTIONS as readonly number[]).includes(n) ? n : IDLE_DEFAULT;
}
