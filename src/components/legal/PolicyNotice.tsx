import type { Dictionary } from "@/lib/i18n";
import { TERMS_VERSION, operatorDetails } from "@/lib/legal/operator";

/** Draft notice (until the texts are reviewed), version, and the operator's contact details. */
export function PolicyNotice({ t }: { t: Dictionary }) {
  const op = operatorDetails();
  const tl = t.legal;
  const hasOperator = Boolean(op.name || op.email || op.address);
  return (
    <>
      {!op.reviewed && <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{tl.draftNotice}</p>}
      <p className="text-xs text-muted">{tl.version}: <span className="num">{TERMS_VERSION}</span></p>
      <section>
        <h2 className="mb-2 text-lg font-semibold text-ink">{tl.operatorTitle}</h2>
        {hasOperator ? (
          <ul className="space-y-1 text-sm text-ink-soft">
            {op.name && <li><bdi>{op.name}</bdi></li>}
            {op.address && <li><bdi>{op.address}</bdi></li>}
            {op.email && <li><a className="text-brand-700 hover:underline" href={`mailto:${op.email}`}>{op.email}</a></li>}
            {op.privacyEmail && <li>{tl.privacyContact}: <a className="text-brand-700 hover:underline" href={`mailto:${op.privacyEmail}`}>{op.privacyEmail}</a></li>}
          </ul>
        ) : <p className="text-sm text-muted">{tl.operatorMissing}</p>}
      </section>
    </>
  );
}
