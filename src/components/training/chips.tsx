import { FIELD_TONES, fieldDisplay, filledFields, type ExercisePatch, type FieldKey } from "@/lib/builder-fields";
import { cx } from "@/components/ui";

/** Read-only prescription chips (used for athletes and in the builder's structure view). */
export function ChipRow({ e, labels, className }: { e: ExercisePatch; labels: Record<FieldKey, string>; className?: string }) {
  const keys = filledFields(e);
  if (keys.length === 0) return null;
  return (
    <ul className={cx("flex flex-wrap gap-1.5", className)}>
      {keys.map((k) => (
        <li key={k} className={cx("num inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs", FIELD_TONES[k])}>
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{labels[k]}</span>
          <span className="text-[13px] font-semibold">{fieldDisplay(e, k)}</span>
        </li>
      ))}
    </ul>
  );
}
