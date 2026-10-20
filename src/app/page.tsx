import { redirect } from "next/navigation";
import { ButtonLink, Logo } from "@/components/ui";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { getSession } from "@/lib/auth";

export default async function Landing() {
  const { user, t, locale } = await getSession();
  if (user) redirect("/dashboard");
  const features = [
    [t.landing.f1, t.landing.f1d],
    [t.landing.f2, t.landing.f2d],
    [t.landing.f3, t.landing.f3d],
    [t.landing.f4, t.landing.f4d],
  ];
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo className="text-lg text-ink" />
        <div className="flex items-center gap-2">
          <LanguageSwitch locale={locale} next="/" className="text-ink-soft" />
          <ButtonLink href="/login" variant="ghost">{t.landing.signIn}</ButtonLink>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{t.tagline}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{t.landing.headline}</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-soft">{t.landing.sub}</p>
        <div className="mt-8 flex gap-3">
          <ButtonLink href="/signup" className="px-5 py-2.5">{t.landing.getStarted}</ButtonLink>
          <ButtonLink href="/login" variant="secondary" className="px-5 py-2.5">{t.landing.signIn}</ButtonLink>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(([title, body]) => (
            <div key={title} className="rounded-xl border border-line p-5">
              <div className="mb-3 h-1 w-8 rounded-full bg-brand-500" />
              <h2 className="font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">{t.footer.disclaimer}</footer>
    </div>
  );
}
