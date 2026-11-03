import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo, LogoMark } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { getSession } from "@/lib/auth";
import { ThemeSwitch } from "@/components/shell/ThemeSwitch";
import { getTheme } from "@/lib/theme/server";
import type { Dictionary } from "@/lib/i18n";

/** iOS system colours (light, dark) used as app-icon tiles. Icons on them are white and decorative. */
const TINTS = [
  "from-[#34c759] to-[#248a3d]",
  "from-[#0a84ff] to-[#0060df]",
  "from-[#ff9f0a] to-[#f56300]",
  "from-[#ff453a] to-[#d70015]",
  "from-[#bf5af2] to-[#8944ab]",
  "from-[#ff375f] to-[#d30f45]",
  "from-[#40c8e0] to-[#0a8fae]",
  "from-[#5e5ce6] to-[#3634a3]",
  "from-[#30b0c7] to-[#1d7f99]",
];

/** Outline icon paths for the feature tiles (24px grid). */
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

const ACCOUNT_ICONS = {
  team: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8",
  independent: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  athlete: "M2 12h4l3-8 4 16 3-8h6",
} as const;

function Glyph({ d, className = "size-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** A rounded-square "app icon" tile in an iOS system colour. */
function AppIcon({ d, tint, size = "size-11" }: { d: string; tint: string; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-[22%] bg-gradient-to-b ${tint} text-white shadow-[0_1px_2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25)]`}>
      <Glyph d={d} className="size-[55%]" />
    </span>
  );
}

const pillPrimary =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#157a4a] px-6 text-[15px] font-semibold text-white shadow-sm transition-[transform,background-color] duration-200 ease-[var(--ease-ios)] hover:bg-[#12623d] active:scale-[0.97]";
const linkChevron = "inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-brand-600 hover:underline underline-offset-4";
const grouped = "overflow-hidden rounded-[20px] bg-surface ring-1 ring-black/[0.04] dark:ring-white/[0.06]";
const title = "text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-5xl";

export default async function Landing() {
  const { user, t, locale } = await getSession();
  if (user) redirect("/dashboard");
  const theme = await getTheme();
  const L = t.landing;
  const rtl = locale === "he";
  const forward = rtl ? "arrowLeft" : "arrowRight";
  const chevron = rtl ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6";
  const features = [
    [L.f1, L.f1d], [L.f2, L.f2d], [L.f3, L.f3d], [L.f4, L.f4d], [L.f5, L.f5d],
    [L.f6, L.f6d], [L.f7, L.f7d], [L.f8, L.f8d], [L.f9, L.f9d],
  ];
  const sections = [
    ["#features", L.nav.features, FEATURE_ICONS[2]],
    ["#how", L.nav.how, FEATURE_ICONS[1]],
    ["#audience", L.nav.audience, FEATURE_ICONS[0]],
    ["#faq", L.nav.faq, FEATURE_ICONS[8]],
  ] as const;

  return (
    <div className="min-h-dvh overflow-x-clip scroll-smooth">
      {/* Navigation bar: translucent material with a hairline, like a UINavigationBar. */}
      <header className="glass sticky top-0 z-30 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo className="text-[17px] text-ink" />
          <nav aria-label={L.sectionsLabel} className="hidden items-center gap-7 text-[13px] text-ink-soft md:flex">
            {sections.map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-ink">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <ThemeSwitch current={theme} labels={{ system: t.settings.themeNames.system, light: t.settings.themeNames.light, dark: t.settings.themeNames.dark }} next="/" />
            </div>
            <LanguageSwitch locale={locale} next="/" className="text-ink-soft" />
            <Link href="/login" className="hidden min-h-11 items-center px-3 text-[14px] font-medium text-brand-600 sm:inline-flex">{L.signIn}</Link>
            <Link href="/signup" className="inline-flex min-h-9 items-center rounded-full bg-[#157a4a] px-4 text-[13px] font-semibold text-white transition-transform active:scale-95">{L.getStarted}</Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="pb-28 md:pb-0">
        {/* Hero: centred, product-page style, with a device. */}
        <section className="mx-auto max-w-6xl px-4 pt-14 text-center sm:px-6 sm:pt-24">
          <p className="text-[13px] font-semibold text-brand-600 sm:text-[15px]">Performance360</p>
          <h1 className="mx-auto mt-3 max-w-4xl text-balance text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-7xl">{L.headline}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-[17px] leading-relaxed text-ink-soft sm:text-xl">{L.sub}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/signup" className={pillPrimary}>{L.getStarted}</Link>
            <Link href="/login" className={linkChevron}>{L.signIn}<Glyph d={chevron} className="size-4" /></Link>
          </div>
          <ul className="mx-auto mt-7 flex max-w-3xl flex-wrap justify-center gap-2">
            {L.heroPoints.map((p) => (
              <li key={p} className="inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1.5 text-[13px] text-ink-soft ring-1 ring-black/[0.05] dark:ring-white/[0.07]">
                <Icon name="check" className="size-3.5 text-brand-600" />{p}
              </li>
            ))}
          </ul>
          <DeviceStage m={L.mock} />
        </section>

        {/* The cycle: a horizontally scrolling shelf on phones, a row on desktop. */}
        <section aria-labelledby="cycle" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
          <h2 id="cycle" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{L.cycleHeading}</h2>
          <ol className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0">
            {L.cycle.map(([name, body], i) => (
              <li key={name} className="w-36 shrink-0 snap-start rounded-[18px] bg-surface p-4 ring-1 ring-black/[0.04] lg:w-auto dark:ring-white/[0.06]">
                <span className="num text-[12px] font-semibold text-brand-600">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 text-[17px] font-semibold tracking-tight text-ink">{name}</p>
                <p className="mt-1 text-[13px] leading-[1.35] text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Who it's for: an inset grouped list, like Settings. */}
        <section id="audience" aria-labelledby="choose" className="mx-auto max-w-3xl scroll-mt-20 px-4 pt-20 sm:px-6 sm:pt-28">
          <h2 id="choose" className={title}>{L.chooseHeading}</h2>
          <p className="mt-3 text-[17px] text-ink-soft">{L.audienceSub}</p>
          <ul className={`mt-7 divide-y divide-line/70 ${grouped}`}>
            {(["team", "independent", "athlete"] as const).map((key, i) => {
              const info = t.accountTypes[key];
              return (
                <li key={key}>
                  <Link href={`/signup?next=${encodeURIComponent(`/onboarding?type=${key}`)}`} data-account-type={key} className="flex min-h-16 items-center gap-4 px-4 py-3.5 transition-colors hover:bg-canvas/70 active:bg-canvas">
                    <AppIcon d={ACCOUNT_ICONS[key]} tint={TINTS[[0, 1, 2][i]]} size="size-10" />
                    <span className="min-w-0 flex-1 text-start">
                      <span className="block text-[17px] font-medium text-ink">{info.title}</span>
                      <span className="mt-0.5 block text-[14px] leading-snug text-muted">{info.body}</span>
                    </span>
                    <Glyph d={chevron} className="size-4 shrink-0 text-muted/70" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Features: home-screen style widgets. */}
        <section id="features" aria-labelledby="features-h" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6 sm:pt-28">
          <h2 id="features-h" className={title}>{L.featuresHeading}</h2>
          <p className="mt-3 max-w-2xl text-[17px] text-ink-soft">{L.featuresSub}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {features.map(([name, body], i) => (
              <article key={name} className="rounded-[24px] bg-surface p-5 ring-1 ring-black/[0.04] transition-transform duration-300 ease-[var(--ease-ios)] hover:-translate-y-0.5 sm:p-6 dark:ring-white/[0.06]">
                <AppIcon d={FEATURE_ICONS[i]} tint={TINTS[i]} />
                <h3 className="mt-4 text-[19px] font-semibold tracking-tight text-ink">{name}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works. */}
        <section id="how" aria-labelledby="how-h" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6 sm:pt-28">
          <h2 id="how-h" className={title}>{L.howHeading}</h2>
          <ol className="mt-8 grid gap-3 md:grid-cols-3 lg:gap-4">
            {L.how.map(([name, body], i) => (
              <li key={name} className="rounded-[24px] bg-surface p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                <span className="num block text-5xl font-semibold tracking-[-0.04em] text-brand-600">{i + 1}</span>
                <h3 className="mt-4 text-[19px] font-semibold tracking-tight text-ink">{name}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Privacy: a dark panel with a grouped checklist. */}
        <section aria-labelledby="trust-h" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
          <div className="grid gap-8 rounded-[32px] bg-[#101614] p-6 text-white ring-1 ring-white/10 sm:p-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <span className="grid size-14 place-items-center rounded-[22%] bg-gradient-to-b from-[#0a84ff] to-[#0060df] text-white">
                <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              </span>
              <h2 id="trust-h" className="mt-6 text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-5xl">{L.trustHeading}</h2>
              <p className="mt-3 text-[17px] text-white/65">{L.trustSub}</p>
              <Link href="/privacy" className="mt-4 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-[#64d2ff] hover:underline underline-offset-4">{L.footerLinks.privacy}<Glyph d={chevron} className="size-4" /></Link>
            </div>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-[20px] bg-white/[0.07]">
              {L.trust.map((item) => (
                <li key={item} className="flex items-start gap-3 px-4 py-3.5 text-[15px] leading-snug text-white/90">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#30d158] text-[#04140b]"><Icon name="check" className="size-3" /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ: one grouped list with disclosure rows. */}
        <section id="faq" aria-labelledby="faq-h" className="mx-auto max-w-3xl scroll-mt-20 px-4 pt-20 sm:px-6 sm:pt-28">
          <h2 id="faq-h" className={title}>{L.faqHeading}</h2>
          <div className={`mt-7 divide-y divide-line/70 ${grouped}`}>
            {L.faq.map(([q, a]) => (
              <details key={q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-[17px] text-ink transition-colors hover:bg-canvas/60 [&::-webkit-details-marker]:hidden">
                  {q}
                  <Glyph d="M6 9l6 6 6-6" className="size-4 shrink-0 text-muted transition-transform duration-300 ease-[var(--ease-ios)] group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-[15px] leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing call to action. */}
        <section aria-labelledby="cta-h" className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <span className="mx-auto grid size-20 place-items-center rounded-[22%] bg-white shadow-[0_12px_30px_-10px_rgba(14,90,56,0.45)] ring-1 ring-black/[0.05]">
            <LogoMark className="size-14 [--color-logo:#0e5a38]" />
          </span>
          <h2 id="cta-h" className={`mx-auto mt-7 max-w-3xl ${title}`}>{L.ctaHeading}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] text-ink-soft">{L.ctaSub}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/signup" className={pillPrimary}>{L.getStarted}<Icon name={forward} /></Link>
            <Link href="/login" className={linkChevron}>{L.signIn}<Glyph d={chevron} className="size-4" /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.06] pb-28 md:pb-0 dark:border-white/[0.08]">
        <div className="mx-auto max-w-6xl px-4 py-6 text-[12px] text-muted sm:px-6">
          <p>{t.footer.disclaimer}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
            <span>Performance360</span>
            <nav aria-label={L.footerLinks.privacy} className="-my-3 flex gap-4">
              <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-ink">{L.footerLinks.privacy}</Link>
              <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-ink">{L.footerLinks.terms}</Link>
              <Link href="/accessibility" className="inline-flex min-h-11 items-center hover:text-ink">{L.footerLinks.accessibility}</Link>
            </nav>
          </div>
        </div>
      </footer>

      {/* Phone tab bar: a floating material capsule that jumps between sections. */}
      <nav aria-label={L.sectionsLabel} className="glass fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-sm justify-around rounded-full px-2 py-1.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.06] md:hidden dark:ring-white/[0.1]">
        {sections.map(([href, label, d]) => (
          <a key={href} href={href} className="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[10px] font-medium text-ink-soft active:text-brand-600">
            <Glyph d={d} className="size-[22px]" />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}

/** Decorative iPhone with the athlete "Today" screen, flanked by two widgets on wide screens. Hidden from screen readers. */
function DeviceStage({ m }: { m: Dictionary["landing"]["mock"] }) {
  const ring = (r: number, pct: number, color: string, w = 7) => {
    const c = 2 * Math.PI * r;
    return (
      <>
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeOpacity="0.2" strokeWidth={w} />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 40 40)" />
      </>
    );
  };
  const days = [1, 1, 0, 1, 1, 0, 0];
  return (
    <div aria-hidden className="relative mx-auto mt-14 flex max-w-5xl items-end justify-center gap-8 sm:mt-20">
      <div className="pointer-events-none absolute inset-x-0 bottom-10 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-brand-300/40 blur-3xl" />

      {/* Readiness widget */}
      <div className="mb-24 hidden w-52 rounded-[28px] bg-surface p-4 text-start shadow-[var(--shadow-lift)] ring-1 ring-black/[0.04] lg:block dark:ring-white/[0.06]">
        <p className="text-[13px] font-semibold text-ink">{m.readiness}</p>
        <div className="mt-2 flex items-center gap-3">
          <svg viewBox="0 0 80 80" className="size-20">{ring(34, 0.78, "#30d158")}{ring(25, 0.6, "#0a84ff")}{ring(16, 0.42, "#ff9f0a")}</svg>
          <ul className="space-y-1 text-[11px] text-muted">
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#30d158]" />{m.sleep}</li>
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#0a84ff]" />{m.load}</li>
            <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#ff9f0a]" />{m.soreness}</li>
          </ul>
        </div>
      </div>

      {/* iPhone */}
      <div className="relative w-[280px] shrink-0 rounded-[52px] bg-[#1c1c1e] p-[10px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.45),inset_0_0_0_1.5px_rgba(255,255,255,0.12)] sm:w-[310px]">
        <div className="relative overflow-hidden rounded-[42px] bg-canvas text-start">
          <div className="absolute left-1/2 top-2.5 z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
          <div className="num flex h-12 items-end justify-between px-7 pb-1 text-[12px] font-semibold text-ink">
            <span>9:41</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-4 rounded-[3px] border border-ink/70" /></span>
          </div>
          <div className="px-4 pb-4">
            <p className="mt-2 text-[12px] font-medium uppercase text-muted">{m.date}</p>
            <p className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-ink">{m.today}</p>

            <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-surface p-3">
              <svg viewBox="0 0 80 80" className="size-16 shrink-0">{ring(34, 0.78, "#30d158", 9)}{ring(22, 0.6, "#0a84ff", 9)}</svg>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">{m.readiness}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[#248a3d] dark:text-[#30d158]"><Icon name="check" className="size-3" />{m.checkIn}</p>
              </div>
            </div>

            <p className="mt-4 px-1 text-[12px] font-medium uppercase text-muted">{m.workout}</p>
            <ul className="mt-1.5 divide-y divide-line/70 overflow-hidden rounded-[14px] bg-surface">
              {m.ex.map((ex, i) => (
                <li key={ex} className="flex items-center gap-3 px-3 py-2.5">
                  <span className={`grid size-7 place-items-center rounded-[8px] bg-gradient-to-b ${TINTS[[0, 2, 4][i]]} text-white`}><Glyph d={FEATURE_ICONS[2]} className="size-3.5" /></span>
                  <span className="flex-1 truncate text-[13px] text-ink">{ex}</span>
                  <span className="num text-[12px] text-muted">{m.sets}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 px-1 text-[12px] font-medium uppercase text-muted">{m.week}</p>
            <div className="mt-1.5 flex justify-between rounded-[14px] bg-surface px-3 py-3">
              {days.map((on, i) => (
                <span key={i} className={`size-6 rounded-full ${on ? "bg-brand-500" : "bg-line"}`} />
              ))}
            </div>
          </div>
          <div className="glass flex justify-around border-t border-black/[0.06] px-6 pb-5 pt-2.5 dark:border-white/[0.08]">
            {[FEATURE_ICONS[4], FEATURE_ICONS[1], FEATURE_ICONS[2], FEATURE_ICONS[0]].map((d, i) => (
              <span key={i} className={i === 0 ? "text-brand-600" : "text-muted/70"}><Glyph d={d} className="size-[22px]" /></span>
            ))}
          </div>
          <div className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-ink/80" />
        </div>
      </div>

      {/* Calendar widget */}
      <div className="mb-40 hidden w-52 rounded-[28px] bg-surface p-4 text-start shadow-[var(--shadow-lift)] ring-1 ring-black/[0.04] lg:block dark:ring-white/[0.06]">
        <p className="text-[13px] font-semibold text-[#ff453a]">{m.week}</p>
        <div className="mt-3 space-y-2">
          {[["bg-[#30d158]", "w-4/5"], ["bg-[#0a84ff]", "w-3/5"], ["bg-[#ff9f0a]", "w-2/3"], ["bg-[#bf5af2]", "w-1/2"]].map(([c, w], i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`h-7 w-1 rounded-full ${c}`} />
              <span className={`h-2.5 rounded-full bg-ink/15 ${w}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
