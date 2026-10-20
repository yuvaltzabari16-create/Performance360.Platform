import Link from "next/link";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { Profile, UserRole } from "@/lib/types";
import { LanguageSwitch } from "./LanguageSwitch";
import { NavLinks } from "./NavLinks";
import { navFor } from "./nav";

export function AppShell({ profile, t, unread, children }: { profile: Profile & { role: UserRole }; t: Dictionary; unread: number; children: React.ReactNode }) {
  const items = navFor(profile.role, t);
  const userBlock = (
    <div className="border-t border-white/10 p-3">
      <div className="px-3 pb-2">
        <div className="truncate text-sm font-medium text-white">{profile.full_name || profile.email}</div>
        <div className="truncate text-xs text-white/50">{t.roles[profile.role]}</div>
      </div>
      <div className="flex items-center justify-between px-1 text-white">
        <LanguageSwitch locale={profile.locale} />
        <form action={signOut}>
          <button className="rounded-md px-2 py-1 text-xs text-white/70 hover:text-white" type="submit">{t.common.signOut}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-charcoal lg:flex">
        <Link href="/dashboard" className="px-6 py-5 text-white"><Logo className="text-base" /></Link>
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Main"><NavLinks items={items} unread={unread} /></nav>
        {userBlock}
      </aside>

      {/* Mobile top bar with disclosure menu (works without JavaScript) */}
      <div className="no-print sticky top-0 z-30 lg:hidden">
        <details className="group bg-charcoal">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-white [&::-webkit-details-marker]:hidden">
            <Logo className="text-sm" />
            <span className="flex items-center gap-2 text-sm text-white/80">
              {unread > 0 && <span className="num rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-white">{unread}</span>}
              {t.nav.menu}
            </span>
          </summary>
          <nav className="max-h-[75dvh] overflow-y-auto px-3 pb-2" aria-label="Main"><NavLinks items={items} unread={unread} /></nav>
          {userBlock}
        </details>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {profile.deactivated_at && (
          <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">{t.settings.deactivated}</div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        <footer className="no-print px-4 py-6 text-center text-xs text-muted sm:px-8">{t.footer.disclaimer}</footer>
      </div>
    </div>
  );
}
