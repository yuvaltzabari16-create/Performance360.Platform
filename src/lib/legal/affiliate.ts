/**
 * Detects affiliate (commission) links so they can be disclosed next to the link.
 * A link counts as affiliate when its host is listed in AFFILIATE_DOMAINS or it carries a
 * typical affiliate tracking parameter.
 */

const AFFILIATE_PARAMS = ["aff", "aff_id", "affid", "affiliate", "affiliate_id", "partner", "partner_id", "tag"];

/** Hosts from AFFILIATE_DOMAINS (comma separated, e.g. "amazon.com,iherb.com"). */
export function affiliateHosts(): string[] {
  return (process.env.AFFILIATE_DOMAINS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** True when `url` is an affiliate link. Invalid URLs are never affiliate. */
export function isAffiliateUrl(url: string, hosts: string[] = affiliateHosts()): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return true;
    if (u.searchParams.get("utm_medium")?.toLowerCase() === "affiliate") return true;
    return AFFILIATE_PARAMS.some((p) => u.searchParams.has(p));
  } catch {
    return false;
  }
}
