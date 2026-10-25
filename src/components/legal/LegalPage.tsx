import Link from "next/link";
import { Logo } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { LegalFooter } from "./LegalFooter";

/** Shared frame for public legal pages: logo, readable column, footer links. */
export async function LegalPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  const { t, user } = await getSession();
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Link href={user ? "/dashboard" : "/"} aria-label="Performance360"><Logo className="text-lg text-ink" /></Link>
        <Link href={user ? "/dashboard" : "/login"} className="text-sm text-brand-700 hover:underline">{t.legal.backHome}</Link>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {intro && <p className="mt-3 text-ink-soft">{intro}</p>}
        <div className="mt-8 space-y-8">{children}</div>
      </main>
      <footer className="py-6 text-center text-xs text-muted"><LegalFooter t={t} /></footer>
    </div>
  );
}

/** A titled section inside a legal page. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-ink">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-ink-soft">{children}</div>
    </section>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return <ul className="list-disc space-y-1.5 ps-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}
