/**
 * Pages anyone may open without signing in: the only ones listed in the sitemap and open to search engines.
 * Everything else sits behind sign-in and is kept out of search results.
 */
export const PUBLIC_PAGES = ["/", "/login", "/signup", "/privacy", "/terms", "/accessibility", "/licenses", "/disclosure"] as const;

/** Signed-in areas; robots.txt asks crawlers not to visit them (they redirect to sign-in anyway). */
export const PRIVATE_PREFIXES = [
  "/dashboard", "/athletes", "/billing", "/calendar", "/code", "/connect", "/exercises", "/export", "/gps", "/injuries",
  "/messages", "/notifications", "/readiness", "/settings", "/team", "/teams", "/testing", "/training", "/onboarding",
  "/join", "/setup", "/auth", "/api", "/files", "/assistant", "/forgot-password",
] as const;

/** Absolute base URL for sitemap and share links (NEXT_PUBLIC_SITE_URL, without a trailing slash). */
export function publicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
