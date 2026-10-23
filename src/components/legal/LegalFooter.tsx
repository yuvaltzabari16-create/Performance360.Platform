import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

/** Links to the legal pages; shown in every footer. */
export function LegalFooter({ t, className }: { t: Dictionary; className?: string }) {
  return (
    <nav aria-label="Legal" className={className ?? "flex flex-wrap justify-center gap-x-4 gap-y-1"}>
      <Link href="/accessibility" className="hover:underline">{t.legal.footerAccessibility}</Link>
      <Link href="/disclosure" className="hover:underline">{t.legal.footerDisclosures}</Link>
      <Link href="/licenses" className="hover:underline">{t.legal.footerLicenses}</Link>
    </nav>
  );
}
