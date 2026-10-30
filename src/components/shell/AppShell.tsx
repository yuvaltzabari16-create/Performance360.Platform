import Link from "next/link";
import { signOut } from "@/app/actions";
import { Avatar, Logo } from "@/components/ui";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { assistantRole } from "@/lib/assistant/roles";
import { LegalFooter } from "@/components/legal/LegalFooter";
import type { Dictionary } from "@/lib/i18n";
import type { OrgMembership, Profile, UserRole } from "@/lib/types";
import { LanguageSwitch } from "./LanguageSwitch";
import { NavLinks } from "./NavLinks";
import { TabBar } from "./TabBar";
import { QuickButton } from "./QuickButton";
import { ThemeSwitch } from "./ThemeSwitch";
import { quickActionsFor } from "@/lib/quick-actions";
import type { Theme } from "@/lib/theme/theme";
import { navFor } from "./nav";
import { canAccess } from "@/lib/permissions";

export function AppShell({ profile, org, t, unread, theme, children }: { profile: Profile & { role: UserRole }; org: OrgMembership | null; t: Dictionary; unread: number; theme: Theme; children: React.ReactNode }) {
  const items = navFor(profile.role, t, org?.org_role ?? null);
  const quick = quickActionsFor(profile.role, org?.org_role ?? null, t);
  const aRole = assistantRole(profile.role, org?.org_role ?? null);
  const { starters, ...assistantLabels } = t.assistant;
  const themeLabels = { system: t.settings.themeNames.system, light: t.settings.themeNames.light, dark: t.settings.themeNames.dark };
  const userBlock = (
    <div className="border-t border-line/50 p-3">
      <div className="flex items-center gap-3 px-2 pb-3">
        <Avatar name={profile.full_name || profile.email} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink">{profile.full_name || profile.email}</div>
          <div className="truncate text-xs text-muted">{org ? `${t.orgRoles[org.org_role]} · ${org.org_name}` : t.roles[profile.role]}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-ink-soft">
        <ThemeSwitch current={theme} labels={themeLabels} />
        <div className="flex items-center">
          <LanguageSwitch locale={profile.locale} />
          <form action={signOut}>
            <button className="press rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50" type="submit">{t.common.signOut}</button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar: a floating translucent panel */}
      <aside className="no-print sticky top-0 hidden h-dvh w-72 shrink-0 p-4 lg:block">
        <div className="glass flex h-full flex-col rounded-[28px] shadow-[var(--shadow-lift)] ring-1 ring-line/60">
          <Link href="/dashboard" className="px-6 py-6 text-ink"><Logo className="text-base" /></Link>
          <QuickButton actions={quick} title={t.quick.title} closeLabel={t.quick.close} />
          <nav className="flex-1 overflow-y-auto px-3" aria-label="Main"><NavLinks items={items} unread={unread} /></nav>
          {userBlock}
        </div>
      </aside>

      {/* Phone: a slim translucent title bar on top and the tab bar at the bottom */}
      <div className="no-print glass sticky top-0 z-30 border-b border-line/50 lg:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between px-4 py-2.5">
          <Link href="/dashboard" className="text-ink"><Logo className="text-sm" /></Link>
          <Avatar name={profile.full_name || profile.email} size="sm" />
        </div>
      </div>
      <TabBar items={items} unread={unread} moreLabel={t.nav.menu} closeLabel={t.common.close} quick={quick} quickLabel={t.quick.title}>{userBlock}</TabBar>

      <div className="flex min-w-0 flex-1 flex-col">
        {profile.deactivated_at && (
          <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">{t.settings.deactivated}</div>
        )}
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">{children}</main>
        <footer className="no-print space-y-2 px-4 pb-24 pt-6 text-center text-xs text-muted sm:px-8 lg:pb-6"><p>{t.footer.disclaimer}</p><LegalFooter t={t} /></footer>
      </div>
      {canAccess("assistant", profile.role, org?.org_role ?? null) && <AssistantWidget labels={assistantLabels} starters={starters[aRole]} roleKey={aRole} />}
    </div>
  );
}
