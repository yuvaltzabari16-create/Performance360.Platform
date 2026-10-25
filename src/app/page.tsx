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
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo className="text-lg text-ink" />
        <div className="flex items-center gap-2">
          <LanguageSwitch locale={locale} next="/" className="text-ink-soft" />
          <ButtonLink href="/login" variant="ghost">{t.landing.signIn}</ButtonLink>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="inline-block rounded-full bg-brand-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{t.tagline}</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-6xl sm:leading-[1.05]">{t.landing.headline}</h1>
            <p className="mt-6 max-w-2xl text-lg text-ink-soft">{t.landing.sub}</p>
            <div className="mt-9 flex gap-3">
              <ButtonLink href="/signup" className="px-6 py-3">{t.landing.getStarted}</ButtonLink>
              <ButtonLink href="/login" variant="secondary" className="px-6 py-3">{t.landing.signIn}</ButtonLink>
            </div>
          </div>
          <HeroPreview />
        </div>
        <section className="mt-14" aria-labelledby="choose">
          <h2 id="choose" className="text-sm font-semibold uppercase tracking-wide text-muted">{t.landing.chooseHeading}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {([
              ["team", t.accountTypes.team, "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8"],
              ["independent", t.accountTypes.independent, "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
              ["athlete", t.accountTypes.athlete, "M2 12h4l3-8 4 16 3-8h6"],
            ] as const).map(([key, info, icon]) => (
              <Link key={key} href={`/signup?next=${encodeURIComponent(`/onboarding?type=${key}`)}`} data-account-type={key} className="group flex flex-col rounded-2xl border border-white/80 bg-white/85 p-6 shadow-[var(--shadow-card)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                <span className="mb-4 grid size-11 place-items-center rounded-xl bg-gradient-to-b from-brand-100 to-brand-50 text-brand-600">
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
            <div key={title} className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-[var(--shadow-card)] backdrop-blur-sm">
              <div className="mb-3 h-1.5 w-9 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
              <h2 className="font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-line/60 py-6 text-center text-xs text-muted">{t.footer.disclaimer}</footer>
    </div>
  );
}

/** Decorative preview of the product (no text, hidden from screen readers): a calendar with coloured sessions and an athlete card. */
function HeroPreview() {
  const chip = ["bg-brand-600", "bg-brand-300", "bg-sky-300", "bg-amber-300", "bg-brand-600", "bg-brand-100", "bg-sky-300"];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-200/60 via-white/0 to-brand-300/50 blur-2xl" />
      <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[var(--shadow-lift)] backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-3 w-28 rounded-full bg-ink/80" />
          <div className="flex gap-1.5"><span className="h-6 w-14 rounded-full bg-brand-100" /><span className="h-6 w-14 rounded-full bg-canvas" /></div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 28 }, (_, i) => (
            <div key={i} className="flex min-h-12 flex-col gap-1 rounded-lg bg-canvas/80 p-1">
              <span className="h-1.5 w-3 rounded-full bg-ink/20" />
              {i % 3 !== 2 && <span className={`h-2.5 rounded ${chip[i % chip.length]}`} />}
              {i % 5 === 0 && <span className="h-2.5 rounded bg-brand-100" />}
            </div>
          ))}
        </div>
      </div>
      <div className="-mt-6 ms-8 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[var(--shadow-lift)] backdrop-blur-md">
        <span className="grid size-10 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 ring-2 ring-white">AL</span>
        <div className="flex-1 space-y-1.5"><div className="h-2.5 w-24 rounded-full bg-ink/70" /><div className="h-2 w-36 rounded-full bg-ink/15" /></div>
        <span className="rounded-full bg-red-100 px-3 py-1"><span className="block h-2 w-8 rounded-full bg-red-400" /></span>
      </div>
    </div>
  );
}
