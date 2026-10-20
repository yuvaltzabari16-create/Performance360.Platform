import { ButtonLink, Logo } from "@/components/ui";
import { getCookieLocale, getDictionary } from "@/lib/i18n";

export default async function NotFound() {
  const t = getDictionary(await getCookieLocale());
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-6 text-lg text-ink" />
      <h1 className="text-xl font-semibold text-ink">{t.common.notFound}</h1>
      <p className="mt-2 text-sm text-ink-soft">{t.common.notAllowed}</p>
      <ButtonLink className="mt-6" href="/dashboard">{t.nav.dashboard}</ButtonLink>
    </main>
  );
}
