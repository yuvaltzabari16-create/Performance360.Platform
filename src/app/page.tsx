import Link from "next/link";
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
        <section className="mt-14" aria-labelledby="choose">
          <h2 id="choose" className="text-sm font-semibold uppercase tracking-wide text-muted">{t.landing.chooseHeading}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {([
              ["team", t.accountTypes.team, "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8"],
              ["independent", t.accountTypes.independent, "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
              ["athlete", t.accountTypes.athlete, "M2 12h4l3-8 4 16 3-8h6"],
            ] as const).map(([key, info, icon]) => (
              <Link key={key} href={`/signup?next=${encodeURIComponent(`/onboarding?type=${key}`)}`} data-account-type={key} className="group flex flex-col rounded-xl border border-line p-5 transition-colors hover:border-brand-400 hover:bg-brand-50/40">
                <span className="mb-4 grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={icon} /></svg>
                </span>
                <span className="font-semibold text-ink">{info.title}</span>
                <span className="mt-1.5 text-sm leading-6 text-ink-soft">{info.body}</span>
              </Link>
            ))}
          </div>
        </section>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
