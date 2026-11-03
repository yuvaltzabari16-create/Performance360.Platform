import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink, Logo } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { getSession } from "@/lib/auth";
import { ThemeSwitch } from "@/components/shell/ThemeSwitch";
import { getTheme } from "@/lib/theme/server";

/** Outline icon paths for the feature cards (24px grid). */
const FEATURE_ICONS = [
  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  "M3 5h18M3 12h12M3 19h8M17 15l2 2 4-4",
  "M4 20V10M10 20V4M16 20v-7M22 20H2",
  "M2 12h4l3-8 4 16 3-8h6",
  "M3 4h18v17H3zM3 9h18M8 2v4M16 2v4M8 14h3",
  "M12 21s-8-4.5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6.5-8 11-8 11zM12 9v5M9.5 11.5h5",
  "M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4",
  "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
];

export default async function Landing() {
  const { user, t, locale } = await getSession();
  if (user) redirect("/dashboard");
  const theme = await getTheme();
  const L = t.landing;
  const features = [
    [L.f1, L.f1d], [L.f2, L.f2d], [L.f3, L.f3d], [L.f4, L.f4d], [L.f5, L.f5d],
    [L.f6, L.f6d], [L.f7, L.f7d], [L.f8, L.f8d], [L.f9, L.f9d],
  ];
  const card = "rounded-2xl bg-surface/90 ring-1 ring-line/60 shadow-[var(--shadow-card)] backdrop-blur-sm";
  const heading = "text-3xl font-bold tracking-tight text-ink sm:text-4xl";
  const forward = locale === "he" ? "arrowLeft" : "arrowRight";
  return (
    <div className="min-h-dvh overflow-x-clip scroll-smooth">
      <header className="sticky top-0 z-30 border-b border-line/50 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo className="text-lg text-ink" />
          <nav aria-label={L.nav.features} className="hidden items-center gap-6 text-sm font-medium text-ink-soft md:flex">
            <a href="#features" className="hover:text-ink">{L.nav.features}</a>
            <a href="#how" className="hover:text-ink">{L.nav.how}</a>
            <a href="#audience" className="hover:text-ink">{L.nav.audience}</a>
            <a href="#faq" className="hover:text-ink">{L.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block"><ThemeSwitch current={theme} labels={{ system: t.settings.themeNames.system, light: t.settings.themeNames.light, dark: t.settings.themeNames.dark }} next="/" /></div>
            <LanguageSwitch locale={locale} next="/" className="text-ink-soft" />
            <ButtonLink href="/login" variant="ghost" className="hidden sm:inline-flex">{L.signIn}</ButtonLink>
            <ButtonLink href="/signup">{L.getStarted}</ButtonLink>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[36rem] max-w-5xl rounded-full bg-gradient-to-b from-brand-200/50 to-transparent blur-3xl" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="inline-block rounded-full bg-brand-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{t.tagline}</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-6xl sm:leading-[1.05]">{L.headline}</h1>
              <p className="mt-6 max-w-2xl text-lg text-ink-soft">{L.sub}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/signup" className="px-6 py-3">{L.getStarted} <Icon name={forward} /></ButtonLink>
                <ButtonLink href="/login" variant="secondary" className="px-6 py-3">{L.signIn}</ButtonLink>
              </div>
              <ul className="mt-8 space-y-2 text-sm text-ink-soft">
                {L.heroPoints.map((p) => (
                  <li key={p} className="flex items-center gap-2"><Icon name="check" className="size-4 text-brand-600" />{p}</li>
                ))}
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* The cycle */}
        <section aria-labelledby="cycle" className="border-y border-line/50 bg-surface/60">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 id="cycle" className="text-center text-sm font-semibold uppercase tracking-wide text-muted">{L.cycleHeading}</h2>
            <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {L.cycle.map(([name, body], i) => (
                <li key={name} className="rounded-xl bg-canvas/80 p-4 ring-1 ring-line/50">
                  <span className="text-xs font-bold text-brand-600">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-1 font-semibold text-ink">{name}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-soft">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who it's for */}
        <section id="audience" aria-labelledby="choose" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 id="choose" className={heading}>{L.chooseHeading}</h2>
          <p className="mt-3 max-w-2xl text-ink-soft">{L.audienceSub}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {([
              ["team", t.accountTypes.team, "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8"],
              ["independent", t.accountTypes.independent, "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
              ["athlete", t.accountTypes.athlete, "M2 12h4l3-8 4 16 3-8h6"],
            ] as const).map(([key, info, icon]) => (
              <Link key={key} href={`/signup?next=${encodeURIComponent(`/onboarding?type=${key}`)}`} data-account-type={key} className={`group flex flex-col p-6 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] ${card}`}>
                <span className="mb-4 grid size-11 place-items-center rounded-xl bg-gradient-to-b from-brand-100 to-brand-50 text-brand-600">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={icon} /></svg>
                </span>
                <span className="font-semibold text-ink">{info.title}</span>
                <span className="mt-1.5 flex-1 text-sm leading-6 text-ink-soft">{info.body}</span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">{L.getStarted} <Icon name={forward} className="size-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" aria-labelledby="features-h" className="scroll-mt-20 bg-surface/50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="features-h" className={heading}>{L.featuresHeading}</h2>
            <p className="mt-3 max-w-2xl text-ink-soft">{L.featuresSub}</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(([title, body], i) => (
                <div key={title} className={`p-6 ${card}`}>
                  <span className="mb-4 grid size-10 place-items-center rounded-xl bg-brand-100/70 text-brand-700">
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={FEATURE_ICONS[i]} /></svg>
                  </span>
                  <h3 className="font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-h" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 id="how-h" className={heading}>{L.howHeading}</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {L.how.map(([title, body], i) => (
              <li key={title} className="relative">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-[var(--shadow-card)]">{i + 1}</span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 leading-7 text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Trust */}
        <section aria-labelledby="trust-h" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid gap-10 rounded-3xl bg-charcoal p-8 text-white sm:p-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 id="trust-h" className="text-3xl font-bold tracking-tight sm:text-4xl">{L.trustHeading}</h2>
              <p className="mt-4 text-white/70">{L.trustSub}</p>
              <Link href="/privacy" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-300 hover:text-brand-200">{L.footerLinks.privacy} <Icon name={forward} /></Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {L.trust.map((item) => (
                <li key={item} className="flex gap-3 rounded-xl bg-white/5 p-4 text-sm leading-6 ring-1 ring-white/10">
                  <Icon name="check" className="mt-0.5 size-4 text-brand-300" />{item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-h" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-20 sm:px-6">
          <h2 id="faq-h" className={`${heading} text-center`}>{L.faqHeading}</h2>
          <div className="mt-10 space-y-3">
            {L.faq.map(([q, a]) => (
              <details key={q} className={`group px-5 py-4 ${card}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {q}
                  <Icon name="down" className="size-4 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 leading-7 text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final call to action */}
        <section aria-labelledby="cta-h" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-14 text-center text-white sm:px-12">
            <div aria-hidden className="absolute -end-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
            <h2 id="cta-h" className="relative text-3xl font-bold tracking-tight sm:text-4xl">{L.ctaHeading}</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/80">{L.ctaSub}</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-800 shadow-sm hover:bg-brand-50">{L.getStarted} <Icon name={forward} /></Link>
              <Link href="/login" className="inline-flex items-center rounded-xl px-6 py-3 font-semibold text-white ring-1 ring-white/40 hover:bg-white/10">{L.signIn}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <Logo className="text-ink" />
          <nav className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink">{L.footerLinks.privacy}</Link>
            <Link href="/terms" className="hover:text-ink">{L.footerLinks.terms}</Link>
            <Link href="/accessibility" className="hover:text-ink">{L.footerLinks.accessibility}</Link>
          </nav>
        </div>
        <p className="pb-6 text-center text-xs text-muted">{t.footer.disclaimer}</p>
      </footer>
    </div>
  );
}

/** Decorative preview of the product (no text, hidden from screen readers): a calendar with coloured sessions and an athlete card. */
function HeroPreview() {
  const chip = ["bg-brand-600", "bg-brand-300", "bg-sky-300", "bg-amber-300", "bg-brand-600", "bg-brand-100", "bg-sky-300"];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-200/60 via-white/0 to-brand-300/50 blur-2xl" />
      <div className="rounded-3xl bg-surface/90 ring-1 ring-line/60 p-5 shadow-[var(--shadow-lift)] backdrop-blur-md">
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
      <div className="-mt-6 ms-8 flex items-center gap-3 rounded-2xl border ring-line/60 bg-surface/90 p-4 shadow-[var(--shadow-lift)] backdrop-blur-md">
        <span className="grid size-10 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 ring-2 ring-surface">AL</span>
        <div className="flex-1 space-y-1.5"><div className="h-2.5 w-24 rounded-full bg-ink/70" /><div className="h-2 w-36 rounded-full bg-ink/15" /></div>
        <span className="rounded-full bg-red-100 px-3 py-1"><span className="block h-2 w-8 rounded-full bg-red-400" /></span>
      </div>
    </div>
  );
}
