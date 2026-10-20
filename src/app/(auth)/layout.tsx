import Link from "next/link";
import { Logo } from "@/components/ui";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { getSession } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getSession();
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/"><Logo className="text-lg text-ink" /></Link>
        <LanguageSwitch locale={locale} next="/login" className="text-ink-soft" />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="py-6 text-center text-xs text-muted">{t.footer.disclaimer}</footer>
    </div>
  );
}
