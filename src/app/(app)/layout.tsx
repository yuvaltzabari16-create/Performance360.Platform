import { AppShell } from "@/components/shell/AppShell";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { IdleLogout } from "@/components/security/IdleLogout";
import { THEME_COOKIE, parseTheme } from "@/lib/theme/theme";
import { requireProfile } from "@/lib/auth";
import { billingRequired, getOrgBilling, isLockExempt } from "@/lib/billing/state";
import { IDLE_COOKIE, parseIdleMinutes } from "@/lib/security/idle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, org, t } = await requireProfile();
  // A team whose trial and subscription have both ended can still pay, change its settings and export its data.
  if (billingRequired() && org) {
    const path = (await headers()).get("x-pathname") ?? "";
    const billing = await getOrgBilling(supabase);
    if (billing && !billing.has_access && !isLockExempt(path)) redirect("/billing");
  }
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const idleMinutes = parseIdleMinutes((await cookies()).get(IDLE_COOKIE)?.value);
  return (
    <AppShell profile={profile} org={org} t={t} unread={count ?? 0} theme={parseTheme((await cookies()).get(THEME_COOKIE)?.value)}>
      {children}
      <IdleLogout minutes={idleMinutes} labels={{ title: t.settings.idleWarnTitle, body: t.settings.idleWarnBody, stay: t.settings.idleStay }} />
    </AppShell>
  );
}
