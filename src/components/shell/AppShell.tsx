import Link from "next/link";
import { signOut } from "@/app/actions";
import { Avatar, Logo } from "@/components/ui";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { assistantRole } from "@/lib/ai/assistant-roles";
import { LegalFooter } from "@/components/legal/LegalFooter";
import type { Dictionary } from "@/lib/i18n";
import type { OrgMembership, Profile, UserRole } from "@/lib/types";
import { LanguageSwitch } from "./LanguageSwitch";
import { NavLinks } from "./NavLinks";
import { navFor } from "./nav";

export function AppShell({ profile, org, t, unread, children }: { profile: Profile & { role: UserRole }; org: OrgMembership | null; t: Dictionary; unread: number; children: React.ReactNode }) {
  const items = navFor(profile.role, t, org?.org_role ?? null);
  const aRole = assistantRole(profile.role, org?.org_role ?? null);
  const { starters, ...assistantLabels } = t.assistant;
  const userBlock = (
    <div className="border-t border-line/70 p-3">
      <div className="flex items-center gap-3 px-2 pb-3">
        <Avatar name={profile.full_name || profile.email} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{profile.full_name || profile.email}</div>
          <div className="truncate text-xs text-muted">{org ? `${t.orgRoles[org.org_role]} · ${org.org_name}` : t.roles[profile.role]}</div>
        </div>
      </div>
      <div className="flex items-center justify-between px-1 text-ink-soft">
        <LanguageSwitch locale={profile.locale} />
        <form action={signOut}>
          <button className="rounded-lg px-2 py-1 text-xs text-ink-soft hover:bg-brand-50 hover:text-ink" type="submit">{t.common.signOut}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-72 shrink-0 p-4 lg:block">
       <div className="flex h-full flex-col rounded-3xl border border-white/80 bg-white/80 shadow-[var(--shadow-lift)] backdrop-blur-md">
        <Link href="/dashboard" className="px-6 py-6 text-ink"><Logo className="text-base" /></Link>
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Main"><NavLinks items={items} unread={unread} /></nav>
        {userBlock}
       </div>
      </aside>

      {/* Mobile top bar with disclosure menu (works without JavaScript) */}
      <div className="no-print sticky top-0 z-30 lg:hidden">
        <details className="group border-b border-line/70 bg-white/85 shadow-[var(--shadow-card)] backdrop-blur-md">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-ink [&::-webkit-details-marker]:hidden">
            <Logo className="text-sm" />
            <span className="flex items-center gap-2 text-sm text-ink-soft">
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
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        <footer className="no-print space-y-2 px-4 py-6 text-center text-xs text-muted sm:px-8"><p>{t.footer.disclaimer}</p><LegalFooter t={t} /></footer>
      </div>
      <AssistantWidget labels={assistantLabels} starters={starters[aRole]} roleKey={aRole} />
    </div>
  );
}
