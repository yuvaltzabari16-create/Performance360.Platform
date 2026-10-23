/**
 * Validation for URLs and paths that come from users or stored data before they are put into
 * href/src attributes. Blocks `javascript:`, `data:` and similar script-carrying schemes (XSS).
 */

/** The URL as a string if it is a well-formed http(s) link, otherwise null. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The path if it is an internal absolute path ("/x"), otherwise null. Rejects "//host" and backslashes. */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}
