import { useI18n } from "../lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="seg" role="group" aria-label="Language">
      <button aria-pressed={lang === "he"} onClick={() => setLang("he")}>עברית</button>
      <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
    </div>
  );
}
