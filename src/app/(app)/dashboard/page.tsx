import { FlashMessage } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { AthleteDashboard } from "./AthleteDashboard";
import { CoachDashboard } from "./CoachDashboard";

export const metadata = { title: "Dashboard" };

/** Picks the dashboard for the signed-in role. Each one lives in its own file. */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { profile, org, t } = await requireProfile();
  return (
    <>
      <FlashMessage ok={sp.ok} />
      {profile.role === "athlete" ? <AthleteDashboard t={t} /> : <CoachDashboard t={t} owner={Boolean(org?.is_owner)} />}
    </>
  );
}
