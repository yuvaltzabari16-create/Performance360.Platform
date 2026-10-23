import Image from "next/image";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { getSession } from "@/lib/auth";

export default async function Landing() {
  const { user, t, locale } = await getSession();
  if (user) redirect("/dashboard");
  const stages = t.tagline.split(" · ");
  const features = [
    [t.landing.f1, t.landing.f1d],
    [t.landing.f2, t.landing.f2d],
    [t.landing.f3, t.landing.f3d],
    [t.landing.f4, t.landing.f4d],
  ];
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Image
          src="/brand/performance360-logo.png"
          alt="Performance360 Athletic Performance"
          width={1902}
          height={370}
          priority
          className="h-8 w-auto sm:h-10"
        />
        <div className="flex items-center gap-2">
          <LanguageSwitch locale={locale} next="/" className="text-ink-soft" />
          <ButtonLink href="/login" variant="ghost">{t.landing.signIn}</ButtonLink>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_30%,rgb(62_176_78/0.12),transparent_70%)] rtl:bg-[radial-gradient(60%_60%_at_20%_30%,rgb(62_176_78/0.12),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-forest/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-forest">
                <span className="size-1.5 rounded-full bg-lime" />
                {t.landing.academy}
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-forest sm:text-5xl lg:text-6xl">
                {t.landing.heroTitle}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">{t.landing.heroSub}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/signup" className="bg-forest px-6 py-3 text-base hover:bg-brand-800">
                  {t.landing.join}
                </ButtonLink>
                <ButtonLink href="#about" variant="secondary" className="px-6 py-3 text-base">
                  {t.landing.meet}
                </ButtonLink>
              </div>
            </div>
            <StageWheel stages={stages} label={t.landing.wheelLabel} rtl={locale === "he"} />
          </div>
        </section>

        <section id="about" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-20 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(([title, body]) => (
              <div key={title} className="rounded-xl border border-line p-5">
                <div className="mb-3 h-1 w-8 rounded-full bg-lime" />
                <h2 className="font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">{t.footer.disclaimer}</footer>
    </div>
  );
}

/** The seven method stages arranged clockwise around the logo mark, starting at the top. */
function StageWheel({ stages, label, rtl }: { stages: string[]; label: string; rtl: boolean }) {
  return (
    <figure className="relative mx-auto aspect-square w-full max-w-[26rem]">
      <figcaption className="sr-only">{label}</figcaption>
      <svg viewBox="0 0 100 100" className={`absolute inset-0 size-full ${rtl ? "-scale-x-100" : ""}`} aria-hidden>
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--color-forest)" strokeOpacity="0.12" strokeWidth="0.6" />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="var(--color-lime)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="160 239"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="absolute inset-[28%] grid place-items-center rounded-full bg-white shadow-[0_10px_40px_-12px_rgb(14_90_56/0.35)]">
        <Image src="/brand/performance360-mark.png" alt="" width={350} height={350} className="w-3/4" />
      </div>
      <ol>
        {stages.map((stage, i) => {
          const angle = (i / stages.length) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + (rtl ? -1 : 1) * 38 * Math.cos(angle);
          const y = 50 + 38 * Math.sin(angle);
          return (
            <li
              key={stage}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-forest/10 bg-white px-2.5 py-1 text-xs font-semibold text-forest shadow-sm sm:text-sm"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="grid size-5 place-items-center rounded-full bg-lime text-[0.65rem] text-white">{i + 1}</span>
              {stage}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
