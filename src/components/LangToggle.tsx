import { useI18n, type Lang } from "../lib/i18n";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";

/** Hebrew / English switch. When signed in, the choice is also saved to the profile so it follows the user. */
export function LangToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const { userId } = useSession();
  const pick = (l: Lang) => {
    setLang(l);
    if (userId) supabase.from("profiles").update({ locale: l }).eq("id", userId).then(() => {}, () => {});
  };
  return (
    <div className={"seg" + (compact ? " seg-compact" : "")} role="group" aria-label="Language / שפה">
      <button aria-pressed={lang === "he"} lang="he" onClick={() => pick("he")}>{compact ? "עב" : "עברית"}</button>
      <button aria-pressed={lang === "en"} lang="en" onClick={() => pick("en")}>{compact ? "EN" : "English"}</button>
    </div>
  );
}
