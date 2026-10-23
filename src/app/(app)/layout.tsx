import { AppShell } from "@/components/shell/AppShell";
import { cookies } from "next/headers";
import { IdleLogout } from "@/components/security/IdleLogout";
import { requireProfile } from "@/lib/auth";
import { IDLE_COOKIE, parseIdleMinutes } from "@/lib/security/idle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, org, t } = await requireProfile();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const idleMinutes = parseIdleMinutes((await cookies()).get(IDLE_COOKIE)?.value);
  return (
    <AppShell profile={profile} org={org} t={t} unread={count ?? 0}>
      {children}
      <IdleLogout minutes={idleMinutes} labels={{ title: t.settings.idleWarnTitle, body: t.settings.idleWarnBody, stay: t.settings.idleStay }} />
    </AppShell>
  );
}
