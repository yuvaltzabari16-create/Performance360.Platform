import { setLocale } from "@/app/actions";
import type { Locale } from "@/lib/types";

export function LanguageSwitch({ locale, next, className }: { locale: Locale; next?: string; className?: string }) {
  const other: Locale = locale === "he" ? "en" : "he";
  return (
    <form action={setLocale} className={className}>
      <input type="hidden" name="locale" value={other} />
      {next && <input type="hidden" name="next" value={next} />}
      <button type="submit" className="rounded-md px-2 py-1 text-xs font-medium text-current opacity-80 hover:opacity-100" lang={other}>
        {other === "he" ? "עברית" : "English"}
      </button>
    </form>
  );
}
