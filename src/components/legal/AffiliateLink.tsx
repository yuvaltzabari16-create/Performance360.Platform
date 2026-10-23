import { useId } from "react";

/**
 * A link that earns the site a commission, with the disclosure shown right next to it
 * (visible badge + announced to screen readers) and rel="sponsored" for search engines.
 */
export function AffiliateLink({ href, children, badge, aria, className }: { href: string; children: React.ReactNode; badge: string; aria: string; className?: string }) {
  const id = useId();
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <a href={href} target="_blank" rel="sponsored nofollow noopener noreferrer" aria-describedby={id} className={className}>{children}</a>
      <span id={id} title={aria} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200">{badge}</span>
    </span>
  );
}
