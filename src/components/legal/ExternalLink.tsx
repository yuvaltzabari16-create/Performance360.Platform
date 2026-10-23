import { getSession } from "@/lib/auth";
import { isAffiliateUrl } from "@/lib/legal/affiliate";
import { safeHttpUrl } from "@/lib/security/url";
import { AffiliateLink } from "./AffiliateLink";

/**
 * Use for every link that leaves the app. It rejects unsafe URLs (javascript:, data:...), opens
 * safely in a new tab, and automatically discloses affiliate links.
 */
export async function ExternalLink({ href, children, className }: { href: string | null | undefined; children: React.ReactNode; className?: string }) {
  const url = safeHttpUrl(href);
  if (!url) return <span>{children}</span>;
  if (isAffiliateUrl(url)) {
    const { t } = await getSession();
    return <AffiliateLink href={url} badge={t.legal.disclosure.affiliateBadge} aria={t.legal.disclosure.affiliateAria} className={className}>{children}</AffiliateLink>;
  }
  return <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}
