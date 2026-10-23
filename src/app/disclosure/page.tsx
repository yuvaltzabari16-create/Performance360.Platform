import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Disclosures" };

/** Affiliate-link, payment and external-link disclosures. */
export default async function DisclosurePage() {
  const { t } = await getSession();
  const d = t.legal.disclosure;
  return (
    <LegalPage title={d.title} intro={d.intro}>
      <LegalSection title={d.affiliateTitle}><p>{d.affiliateBody}</p></LegalSection>
      <LegalSection title={d.paymentsTitle}><p>{d.paymentsBody}</p></LegalSection>
      <LegalSection title={d.linksTitle}><p>{d.linksBody}</p></LegalSection>
    </LegalPage>
  );
}
