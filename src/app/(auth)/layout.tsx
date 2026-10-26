import Link from "next/link";
import { Logo } from "@/components/ui";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { getSession } from "@/lib/auth";
import { ThemeSwitch } from "@/components/shell/ThemeSwitch";
import { getTheme } from "@/lib/theme/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getSession();
  const theme = await getTheme();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/"><Logo className="text-lg text-ink" /></Link>
        <span className="flex items-center gap-2"><ThemeSwitch current={theme} labels={{ system: t.settings.themeNames.system, light: t.settings.themeNames.light, dark: t.settings.themeNames.dark }} /><LanguageSwitch locale={locale} next="/login" className="text-ink-soft" /></span>
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-14">
        <div className="w-full max-w-md rounded-3xl bg-surface/90 ring-1 ring-line/60 p-7 shadow-[var(--shadow-lift)] backdrop-blur-md sm:p-9">{children}</div>
      </main>
      <footer className="space-y-2 py-6 text-center text-xs text-muted"><p>{t.footer.disclaimer}</p><LegalFooter t={t} /></footer>
    </div>
  );
}
