import { BulletList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getSession } from "@/lib/auth";
import { accessibilityContact } from "@/lib/legal/site-config";

export const metadata = { title: "Accessibility statement" };

/** Public accessibility statement (Israeli Standard 5568 / WCAG 2.1 AA). */
export default async function AccessibilityPage() {
  const { t } = await getSession();
  const a = t.legal.a11y;
  const contact = accessibilityContact();
  const hasContact = Boolean(contact.coordinator || contact.email || contact.phone);
  return (
    <LegalPage title={a.title} intro={a.intro}>
      <LegalSection title={a.standardTitle}><p>{a.standardBody}</p></LegalSection>
      <LegalSection title={a.featuresTitle}><BulletList items={a.features} /></LegalSection>
      <LegalSection title={a.limitsTitle}><BulletList items={a.limits} /></LegalSection>
      <LegalSection title={a.reviewTitle}><p>{a.reviewBody}</p></LegalSection>
      <LegalSection title={a.contactTitle}>
        <p>{a.contactIntro}</p>
        {hasContact ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {contact.coordinator && <><dt className="font-medium text-ink">{a.coordinator}</dt><dd><bdi>{contact.coordinator}</bdi></dd></>}
            {contact.email && <><dt className="font-medium text-ink">{a.email}</dt><dd><a className="text-brand-700 underline" href={`mailto:${contact.email}`}><bdi>{contact.email}</bdi></a></dd></>}
            {contact.phone && <><dt className="font-medium text-ink">{a.phone}</dt><dd><a className="text-brand-700 underline" href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}><bdi>{contact.phone}</bdi></a></dd></>}
          </dl>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{a.notConfigured}</p>
        )}
      </LegalSection>
    </LegalPage>
  );
}
