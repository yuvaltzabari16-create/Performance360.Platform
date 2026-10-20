import { AppShell } from "@/components/shell/AppShell";
import { requireProfile } from "@/lib/auth";
import { getTimeZone } from "@/lib/dates.server";
import { TimeZoneCookie } from "@/components/shell/TimeZoneCookie";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, t } = await requireProfile();
  const tz = await getTimeZone();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return (
    <AppShell profile={profile} t={t} unread={count ?? 0}>
      <TimeZoneCookie current={tz} />
      {children}
    </AppShell>
  );
}
