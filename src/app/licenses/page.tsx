import { BulletList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getSession } from "@/lib/auth";
import assets from "@/lib/legal/assets.json";
import deps from "@/lib/legal/dependency-licenses.json";

export const metadata = { title: "Licenses" };

interface Asset { name: string; license: string; source: string; usage: string }

/** Public notice of fonts, icons and software licenses (generated list is refreshed by `npm run check:licenses`). */
export default async function LicensesPage() {
  const { t } = await getSession();
  const l = t.legal.licenses;
  const table = (items: Asset[]) => (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.name} className="rounded-lg border border-line p-3">
          <div className="font-medium text-ink"><bdi>{a.name}</bdi></div>
          <div className="text-xs"><span className="text-muted">{l.license}:</span> <bdi>{a.license}</bdi> · <span className="text-muted">{l.source}:</span> <bdi className="break-all">{a.source}</bdi></div>
          <p className="mt-1 text-xs">{a.usage}</p>
        </li>
      ))}
    </ul>
  );
  return (
    <LegalPage title={l.title} intro={l.intro}>
      <LegalSection title={l.fontsTitle}>{assets.fonts.length ? table(assets.fonts) : <p>{l.noneBundled}</p>}</LegalSection>
      <LegalSection title={l.iconsTitle}>{table(assets.icons)}</LegalSection>
      <LegalSection title={l.softwareTitle}>
        <p>{l.packagesNote}</p>
        <BulletList items={Object.entries(deps.byLicense).map(([lic, n]) => `${lic}: ${n}`)} />
        <details className="mt-2 rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-ink">{deps.packages.length} {l.softwareTitle}</summary>
          <ul className="mt-2 columns-1 gap-6 text-xs sm:columns-2">
            {deps.packages.map((p) => <li key={p.name} className="break-all"><bdi>{p.name}@{p.version}</bdi> — <bdi>{p.license}</bdi></li>)}
          </ul>
        </details>
      </LegalSection>
    </LegalPage>
  );
}
