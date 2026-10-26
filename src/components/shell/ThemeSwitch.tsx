import { setTheme } from "@/app/actions";
import type { Theme } from "@/lib/theme/theme";
import { THEMES } from "@/lib/theme/theme";

const ICON: Record<Theme, string> = {
  system: "M4 5h16v11H4zM9 20h6M12 16v4",
  light: "M12 4V2M12 22v-2M4.9 4.9 3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  dark: "M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z",
};

/** iOS-style segmented control: system, light, dark. Works without JavaScript (one small form per choice). */
export function ThemeSwitch({ current, labels, next }: { current: Theme; labels: Record<Theme, string>; next?: string }) {
  return (
    <div role="group" aria-label={labels.system + " / " + labels.light + " / " + labels.dark} className="inline-flex rounded-xl bg-canvas p-0.5 ring-1 ring-line" data-testid="theme-switch">
      {THEMES.map((t) => (
        <form key={t} action={setTheme}>
          <input type="hidden" name="theme" value={t} />
          {next && <input type="hidden" name="next" value={next} />}
          <button
            type="submit"
            aria-pressed={current === t}
            title={labels[t]}
            className={`press inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-medium ${current === t ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink"}`}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICON[t]} /></svg>
            <span className="sr-only sm:not-sr-only">{labels[t]}</span>
          </button>
        </form>
      ))}
    </div>
  );
}
