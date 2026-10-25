import { LegalPage, LegalSection, BulletList } from "@/components/legal/LegalPage";
import { PolicyNotice } from "@/components/legal/PolicyNotice";
import { getSession } from "@/lib/auth";
import { policyDoc } from "@/lib/legal/policy-text";

export const metadata = { title: "Privacy policy" };

/** Privacy policy: structured text in the visitor's language, with the operator's details and a draft notice until reviewed. */
export default async function Page() {
  const { t, locale } = await getSession();
  const doc = policyDoc("privacy", locale);
  return (
    <LegalPage title={doc.title} intro={doc.intro}>
      <PolicyNotice t={t} />
      {doc.sections.map((s) => (
        <LegalSection key={s.title} title={s.title}>
          {s.body.map((p) => <p key={p}>{p}</p>)}
          {s.bullets && <BulletList items={s.bullets} />}
        </LegalSection>
      ))}
    </LegalPage>
  );
}
