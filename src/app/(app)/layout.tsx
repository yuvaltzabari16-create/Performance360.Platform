import { AppShell } from "@/components/shell/AppShell";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, org, t } = await requireProfile();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return (
    <AppShell profile={profile} org={org} t={t} unread={count ?? 0}>
      {children}
    </AppShell>
  );
}
